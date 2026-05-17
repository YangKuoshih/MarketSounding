/**
 * Knowledge Graph Reader Lambda
 * Handles:
 *   GET /graph/subgraph - Returns full graph (nodes + edges) from S3 cache or DynamoDB
 *   GET /graph/nodes/{id} - Returns single node + connected edges
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  ScanCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import {
  success,
  notFound,
  serverError,
  methodNotAllowed,
} from '../../lib/response';
import { withAuth, UserSession } from '../../lib/auth-middleware';

const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3Client = new S3Client({});

const GRAPH_NODES_TABLE = process.env.GRAPH_NODES_TABLE_NAME || 'graph_nodes';
const GRAPH_EDGES_TABLE = process.env.GRAPH_EDGES_TABLE_NAME || 'graph_edges';
const DOCUMENTS_BUCKET = process.env.DOCUMENTS_BUCKET_NAME || '';
const GRAPH_CACHE_KEY = 'graph/cached-graph.json';

export const handler = withAuth(
  async (
    event: APIGatewayProxyEvent,
    _session: UserSession,
  ): Promise<APIGatewayProxyResult> => {
    const method = event.httpMethod;
    const pathParams = event.pathParameters;
    const queryParams = event.queryStringParameters || {};
    const path = event.path || '';

    if (method !== 'GET') {
      return methodNotAllowed();
    }

    // GET /graph/nodes/{id}
    if (path.includes('/graph/nodes/') && pathParams?.id) {
      return getNodeWithEdges(pathParams.id);
    }

    // GET /graph/subgraph
    if (path.endsWith('/graph/subgraph')) {
      return getSubgraph(queryParams);
    }

    return notFound('Endpoint not found');
  },
);

async function getSubgraph(
  queryParams: Record<string, string | undefined>,
): Promise<APIGatewayProxyResult> {
  const nodeTypeFilter = queryParams.nodeType;
  const useCache = queryParams.cache !== 'false';

  // Try S3 cache first
  if (useCache && DOCUMENTS_BUCKET) {
    try {
      const cachedResult = await s3Client.send(
        new GetObjectCommand({
          Bucket: DOCUMENTS_BUCKET,
          Key: GRAPH_CACHE_KEY,
        }),
      );
      if (cachedResult.Body) {
        const cachedJson = await cachedResult.Body.transformToString();
        const cached = JSON.parse(cachedJson);

        if (nodeTypeFilter) {
          cached.nodes = cached.nodes.filter(
            (n: { nodeType: string }) => n.nodeType === nodeTypeFilter,
          );
          const validNodeIds = new Set(
            cached.nodes.map((n: { nodeId: string }) => n.nodeId),
          );
          cached.edges = cached.edges.filter(
            (e: { sourceNodeId: string; targetNodeId: string }) =>
              validNodeIds.has(e.sourceNodeId) ||
              validNodeIds.has(e.targetNodeId),
          );
        }

        return success(cached);
      }
    } catch (err) {
      console.warn('Cache miss or error, falling back to DynamoDB:', err);
    }
  }

  // Fallback to DynamoDB scan
  try {
    const [nodesResult, edgesResult] = await Promise.all([
      ddbClient.send(
        new ScanCommand({
          TableName: GRAPH_NODES_TABLE,
        }),
      ),
      ddbClient.send(
        new ScanCommand({
          TableName: GRAPH_EDGES_TABLE,
        }),
      ),
    ]);

    let nodes = nodesResult.Items || [];
    if (nodeTypeFilter) {
      nodes = nodes.filter((n) => n.nodeType === nodeTypeFilter);
    }

    let edges = edgesResult.Items || [];
    if (nodeTypeFilter) {
      const validNodeIds = new Set(nodes.map((n) => n.nodeId));
      edges = edges.filter(
        (e) =>
          validNodeIds.has(e.sourceNodeId) ||
          validNodeIds.has(e.targetNodeId),
      );
    }

    return success({ nodes, edges });
  } catch (err) {
    console.error('Failed to scan graph tables:', err);
    return serverError('Failed to load graph data');
  }
}

async function getNodeWithEdges(
  nodeId: string,
): Promise<APIGatewayProxyResult> {
  try {
    // Get the node
    const nodeResult = await ddbClient.send(
      new GetCommand({
        TableName: GRAPH_NODES_TABLE,
        Key: { nodeId },
      }),
    );

    if (!nodeResult.Item) {
      return notFound('Node not found');
    }

    // Get all edges where this node is source
    const outgoingResult = await ddbClient.send(
      new QueryCommand({
        TableName: GRAPH_EDGES_TABLE,
        KeyConditionExpression: 'sourceNodeId = :sid',
        ExpressionAttributeValues: {
          ':sid': nodeId,
        },
      }),
    );

    // Note: incoming edges would require a GSI on targetNodeId
    // For now, return outgoing edges
    return success({
      node: nodeResult.Item,
      edges: outgoingResult.Items || [],
    });
  } catch (err) {
    console.error('Failed to get node:', err);
    return serverError('Failed to load node');
  }
}
