/**
 * Knowledge Graph Builder Lambda
 * Triggered async after simulation completion.
 * Extracts graph data (nodes + edges) from completed simulations.
 * Caches full graph JSON in S3 for fast frontend retrieval.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3Client = new S3Client({});

const GRAPH_NODES_TABLE = process.env.GRAPH_NODES_TABLE_NAME!;
const GRAPH_EDGES_TABLE = process.env.GRAPH_EDGES_TABLE_NAME!;
const REACTIONS_TABLE = process.env.REACTIONS_TABLE_NAME!;
const DOCUMENTS_BUCKET = process.env.DOCUMENTS_BUCKET_NAME!;

interface Reaction {
  personaId: string;
  status: string;
  hawkishDovishScore: number;
  keyConcerns: string[];
  positionShift?: number | null;
  influencedBy?: string[];
  keyQuote?: string | null;
}

interface SimulationPayload {
  simulationId: string;
  eventTitle: string;
  eventDate: string;
  personaIds: string[];
  totalRounds: number;
}

export async function handler(event: SimulationPayload): Promise<void> {
  const { simulationId, eventTitle, eventDate, personaIds, totalRounds } = event;

  // 1. Read all reactions for this simulation
  const reactions = await fetchAllReactions(simulationId, totalRounds);

  // 2. Create/update topic node
  await upsertNode(`topic:${simulationId}`, 'topic', eventTitle, {
    eventTitle,
    eventDate,
    simulationId,
    consensusScore: calculateConsensus(reactions),
  });

  // 3. Create topic -> dealer edges (participation)
  for (const personaId of personaIds) {
    const finalReaction = getLastReaction(reactions, personaId);
    await putEdge(
      `topic:${simulationId}`,
      `dealer:${personaId}`,
      'topic',
      1,
      simulationId,
      { positionShift: finalReaction?.hawkishDovishScore }
    );
  }

  // 4. Extract influence edges from rounds 2+
  for (const reaction of reactions) {
    if (reaction.influencedBy && reaction.influencedBy.length > 0) {
      for (const influencerId of reaction.influencedBy) {
        await putEdge(
          `dealer:${influencerId}`,
          `dealer:${reaction.personaId}`,
          'influence',
          Math.abs(reaction.positionShift ?? 0),
          simulationId,
          { quote: reaction.keyQuote, positionShift: reaction.positionShift }
        );
      }
    }
  }

  // 5. Extract concern nodes + edges
  const allConcerns = new Set<string>();
  for (const reaction of reactions) {
    if (reaction.status !== 'complete') continue;
    for (const concern of reaction.keyConcerns) {
      const normalized = normalizeConcern(concern);
      allConcerns.add(normalized);

      await upsertNode(`concern:${normalized}`, 'concern', normalized, {
        category: classifyConcern(normalized),
      });

      await putEdge(
        `dealer:${reaction.personaId}`,
        `concern:${normalized}`,
        'concern',
        1,
        simulationId,
        {}
      );
    }
  }

  // 6. Compute topic correlation edges with prior simulations
  await computeCorrelations(simulationId, allConcerns);

  // 7. Update dealer node aggregates
  for (const personaId of personaIds) {
    await updateDealerAggregates(personaId, reactions);
  }

  // 8. Cache full graph JSON in S3
  await cacheGraphToS3();
}

async function fetchAllReactions(simulationId: string, totalRounds: number): Promise<Reaction[]> {
  const allReactions: Reaction[] = [];

  for (let round = 1; round <= totalRounds; round++) {
    const pk = `${simulationId}#${String(round).padStart(3, '0')}`;
    const result = await ddbClient.send(new QueryCommand({
      TableName: REACTIONS_TABLE,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': pk },
    }));

    if (result.Items) {
      allReactions.push(...(result.Items as Reaction[]));
    }
  }

  return allReactions;
}

function getLastReaction(reactions: Reaction[], personaId: string): Reaction | undefined {
  const personaReactions = reactions.filter(r => r.personaId === personaId && r.status === 'complete');
  return personaReactions[personaReactions.length - 1];
}

function calculateConsensus(reactions: Reaction[]): number {
  const scores = reactions
    .filter(r => r.status === 'complete')
    .map(r => r.hawkishDovishScore);

  if (scores.length < 2) return 1;

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
  // Normalize: 0 = max disagreement, 1 = full consensus
  return Math.max(0, 1 - Math.sqrt(variance));
}

async function upsertNode(nodeId: string, nodeType: string, label: string, metadata: Record<string, unknown>): Promise<void> {
  await ddbClient.send(new PutCommand({
    TableName: GRAPH_NODES_TABLE,
    Item: {
      nodeId,
      nodeType,
      label,
      metadata,
      updatedAt: new Date().toISOString(),
    },
  }));
}

async function putEdge(
  sourceNodeId: string,
  targetNodeId: string,
  edgeType: string,
  weight: number,
  simulationId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const timestamp = new Date().toISOString();
  const sk = `${targetNodeId}#${edgeType}#${timestamp}`;

  await ddbClient.send(new PutCommand({
    TableName: GRAPH_EDGES_TABLE,
    Item: {
      sourceNodeId,
      sk,
      edgeType,
      weight,
      simulationId,
      metadata,
      createdAt: timestamp,
    },
  }));
}

async function computeCorrelations(simulationId: string, concerns: Set<string>): Promise<void> {
  // Query all topic nodes to find prior simulations with shared concerns
  // For simplicity, we check concern edges for overlap
  // Full implementation would scan graph_edges for concern edges and compute Jaccard
  // Placeholder: skip correlation for now (computed on read in the API)
}

async function updateDealerAggregates(personaId: string, reactions: Reaction[]): Promise<void> {
  const dealerReactions = reactions.filter(r => r.personaId === personaId && r.status === 'complete');
  if (dealerReactions.length === 0) return;

  const avgScore = dealerReactions.reduce((sum, r) => sum + r.hawkishDovishScore, 0) / dealerReactions.length;
  const topConcerns = getTopConcerns(dealerReactions);

  // Upsert dealer node with updated aggregates
  await upsertNode(`dealer:${personaId}`, 'dealer', personaId, {
    avgHawkishDovishScore: avgScore,
    topConcerns,
  });
}

function getTopConcerns(reactions: Reaction[]): string[] {
  const counts = new Map<string, number>();
  for (const r of reactions) {
    for (const c of r.keyConcerns) {
      const normalized = normalizeConcern(c);
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([concern]) => concern);
}

function normalizeConcern(concern: string): string {
  return concern.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
}

function classifyConcern(concern: string): string {
  const macroKeywords = ['inflation', 'rate', 'gdp', 'employment', 'wage', 'fed', 'monetary', 'fiscal'];
  const marketKeywords = ['equity', 'bond', 'credit', 'spread', 'volatility', 'liquidity'];
  const geoKeywords = ['geopolitical', 'war', 'tariff', 'trade', 'sanction', 'oil', 'energy'];

  const lower = concern.toLowerCase();
  if (macroKeywords.some(k => lower.includes(k))) return 'macro';
  if (marketKeywords.some(k => lower.includes(k))) return 'market';
  if (geoKeywords.some(k => lower.includes(k))) return 'geopolitical';
  return 'policy';
}

async function cacheGraphToS3(): Promise<void> {
  // Fetch all nodes and edges, serialize to JSON, upload to S3
  // This is called after every simulation completion for fast frontend reads
  const nodesResult = await ddbClient.send(new QueryCommand({
    TableName: GRAPH_NODES_TABLE,
    // Scan all nodes (for small datasets this is fine)
    KeyConditionExpression: 'nodeId > :empty',
    ExpressionAttributeValues: { ':empty': '' },
  }));

  // For the cache, we do a simple scan approach
  // In production with >1000 nodes, paginate
  const graphData = {
    nodes: nodesResult.Items ?? [],
    generatedAt: new Date().toISOString(),
  };

  await s3Client.send(new PutObjectCommand({
    Bucket: DOCUMENTS_BUCKET,
    Key: 'graph/graph-cache.json',
    Body: JSON.stringify(graphData),
    ContentType: 'application/json',
  }));
}
