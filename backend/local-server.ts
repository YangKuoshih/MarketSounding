import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Stub env vars BEFORE any other imports so Lambda code doesn't throw on missing env vars
process.env.IS_LOCAL = 'true';
process.env.USERS_TABLE_NAME = 'local-users';
process.env.SIMULATIONS_TABLE_NAME = 'local-simulations';
process.env.EVENTS_TABLE_NAME = 'local-events';
process.env.ROUNDS_TABLE_NAME = 'local-rounds';
process.env.REACTIONS_TABLE_NAME = 'local-reactions';
process.env.GRAPH_NODES_TABLE_NAME = 'local-graph-nodes';
process.env.GRAPH_EDGES_TABLE_NAME = 'local-graph-edges';
process.env.STATE_MACHINE_ARN = '';
process.env.JWT_SECRET_ARN = 'local';

import express, { Request, Response } from 'express';
import cors from 'cors';
import * as jwt from 'jsonwebtoken';
import { randomUUID, createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { handler as researchHandler } from './lambdas/research/index';
import { handler as chatHandler } from './lambdas/chat-agent/index';
import { handler as dealerAgentHandler } from './lambdas/dealer-agent/index';
import type { DealerAgentInput, DealerAgentOutput } from './lambdas/dealer-agent/types';
import { loadPersona } from './data/personas';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// ── Local types ───────────────────────────────────────────────────────────────

interface LocalUser {
  userId: string;
  username: string;
  passwordHash: string;
}

interface ReactionData {
  personaId: string;
  status: 'complete' | 'failed';
  ratePathView: string;
  balanceSheetView: string;
  riskAssetView: string;
  keyConcerns: string[];
  hawkishDovishScore: number;
  confidence: number;
  reasoningMd: string;
  positionShift: number | null;
  influencedBy: string[];
  keyQuote: string | null;
}

interface RoundData {
  roundNumber: number;
  roundType: 'initial' | 'peer_response' | 'crisis_reevaluation';
  reactions: ReactionData[];
}

interface LocalSimulation {
  simulationId: string;
  userId: string;
  title: string;
  status: 'running' | 'complete' | 'failed';
  currentRound: number;
  totalRounds: number;
  personaIds: string[];
  eventTitle: string;
  eventSummary: string;
  eventText: string;
  rounds: RoundData[];
  crisisEvents: Array<{ crisisId: string; crisisText: string; injectedAfterRound: number; injectedAt: string }>;
  pendingCrisis: string | null;
  createdAt: string;
  completedAt: string | null;
  error: string | null;
}

// ── Persistent stores ─────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET ?? 'local-dev-secret-not-for-production';

const DB_PATH = resolve(__dirname, '../data/local-db.json');
mkdirSync(dirname(DB_PATH), { recursive: true });

interface GraphQueryRecord {
  queryId: string;
  userId: string;
  createdAt: string;
  naturalLanguage: string;
  operation: string;
  params: Record<string, unknown>;
  explanation: string;
  resultSummary: string;
}

interface DbSchema {
  users: Record<string, LocalUser>;
  simulations: Record<string, LocalSimulation>;
  graphNodes: Array<{ nodeId: string; nodeType: string; label: string; metadata: Record<string, unknown> }>;
  graphEdges: Array<{ sourceNodeId: string; targetNodeId: string; edgeType: string; weight: number }>;
  graphQueries: GraphQueryRecord[];
}

function loadDb(): DbSchema {
  if (existsSync(DB_PATH)) {
    try {
      const parsed = JSON.parse(readFileSync(DB_PATH, 'utf8')) as DbSchema;
      return { users: {}, simulations: {}, graphNodes: [], graphEdges: [], graphQueries: [], ...parsed };
    } catch {
      console.warn('Could not parse local-db.json — starting fresh');
    }
  }
  return { users: {}, simulations: {}, graphNodes: [], graphEdges: [], graphQueries: [] };
}

function saveDb(): void {
  const snapshot: DbSchema = {
    users: Object.fromEntries(userStore),
    simulations: Object.fromEntries(simStore),
    graphNodes: localGraph.nodes,
    graphEdges: localGraph.edges,
    graphQueries: graphQueryStore,
  };
  writeFileSync(DB_PATH, JSON.stringify(snapshot, null, 2), 'utf8');
}

function hashPassword(password: string): string {
  return createHash('sha256').update(password + JWT_SECRET).digest('hex');
}

const initialDb = loadDb();
const userStore = new Map<string, LocalUser>(Object.entries(initialDb.users));
const simStore = new Map<string, LocalSimulation>(Object.entries(initialDb.simulations));
const graphQueryStore: GraphQueryRecord[] = initialDb.graphQueries ?? [];
console.log(`Loaded ${userStore.size} user(s), ${simStore.size} simulation(s), ${graphQueryStore.length} graph queries from local-db.json`);

const localGraph: {
  nodes: Array<{ nodeId: string; nodeType: string; label: string; metadata: Record<string, unknown> }>;
  edges: Array<{ sourceNodeId: string; targetNodeId: string; edgeType: string; weight: number }>;
} = { nodes: initialDb.graphNodes, edges: initialDb.graphEdges };

// ── Express app ───────────────────────────────────────────────────────────────

const app = express();
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json({ limit: '2mb' }));

function makeToken(userId: string, username: string): string {
  return jwt.sign({ userId, username }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '24h' });
}

function getAuthUser(req: Request): { userId: string; username: string } | null {
  const auth = req.headers.authorization ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
    // Reject tokens for users that don't exist in the store (e.g. stale demo tokens)
    if (!userStore.has(payload.userId)) return null;
    return payload;
  } catch {
    return null;
  }
}

function generateId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 12);
}

// ── Lambda adapter helpers ────────────────────────────────────────────────────

function lambdaEvent(req: Request, overrides: Record<string, unknown> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: req.method,
    path: req.path,
    headers: req.headers as Record<string, string>,
    pathParameters: (req.params ?? {}) as Record<string, string>,
    queryStringParameters: (req.query ?? {}) as Record<string, string>,
    body: req.body ? JSON.stringify(req.body) : null,
    multiValueHeaders: {},
    multiValueQueryStringParameters: {},
    isBase64Encoded: false,
    requestContext: {} as APIGatewayProxyEvent['requestContext'],
    resource: '',
    stageVariables: null,
    ...overrides,
  } as APIGatewayProxyEvent;
}

function sendLambdaResult(res: Response, result: APIGatewayProxyResult): void {
  try {
    res.status(result.statusCode).json(JSON.parse(result.body ?? 'null'));
  } catch {
    res.status(result.statusCode).send(result.body ?? '');
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

app.post('/auth/register', (req: Request, res: Response) => {
  const { username, password } = (req.body ?? {}) as { username?: string; password?: string };
  if (!username || !password) {
    return void res.status(400).json({ error: 'Username and password are required' });
  }
  if (!/^[a-zA-Z0-9_]{3,50}$/.test(username)) {
    return void res.status(400).json({ error: 'Username must be 3-50 chars, alphanumeric and underscore only' });
  }
  if (password.length < 8) {
    return void res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  const existing = [...userStore.values()].find(u => u.username === username);
  if (existing) {
    return void res.status(409).json({ error: 'Username already taken' });
  }
  const userId = randomUUID().replace(/-/g, '').slice(0, 12);
  const user: LocalUser = { userId, username, passwordHash: hashPassword(password) };
  userStore.set(userId, user);
  saveDb();
  res.status(201).json({ success: true, token: makeToken(userId, username), userId });
});

app.post('/auth/login', (req: Request, res: Response) => {
  const { username, password } = (req.body ?? {}) as { username?: string; password?: string };
  if (!username || !password) {
    return void res.status(400).json({ error: 'Username and password are required' });
  }
  const user = [...userStore.values()].find(u => u.username === username);
  if (!user || user.passwordHash !== hashPassword(password)) {
    return void res.status(401).json({ error: 'Invalid credentials' });
  }
  res.json({ success: true, token: makeToken(user.userId, user.username), userId: user.userId });
});

app.get('/auth/me', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) return void res.status(401).json({ error: 'Unauthorized' });
  res.json({ userId: authUser.userId, username: authUser.username });
});

// ── Research / events / personas ──────────────────────────────────────────────

app.get('/events/samples', async (req: Request, res: Response) => {
  try {
    const result = await researchHandler(lambdaEvent(req));
    sendLambdaResult(res, result);
  } catch (err) {
    console.error('/events/samples error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/events/research', async (req: Request, res: Response) => {
  try {
    const result = await researchHandler(lambdaEvent(req));
    sendLambdaResult(res, result);
  } catch (err) {
    console.error('/events/research error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/personas', async (req: Request, res: Response) => {
  try {
    const result = await researchHandler(lambdaEvent(req));
    sendLambdaResult(res, result);
  } catch (err) {
    console.error('/personas error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Chat ──────────────────────────────────────────────────────────────────────

app.post('/chat/:personaId', async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) return void res.status(401).json({ error: 'Unauthorized' });

  try {
    const token = makeToken(authUser.userId, authUser.username);
    const result = await (chatHandler as (e: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>)(
      lambdaEvent(req, {
        pathParameters: { personaId: req.params.personaId },
        headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      }),
    );
    sendLambdaResult(res, result);
  } catch (err) {
    console.error('/chat/:personaId error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Simulations (read) ────────────────────────────────────────────────────────

function computeTrajectory(rounds: RoundData[]): number[] {
  return rounds.map((round) => {
    const scores = round.reactions.map((r) => r.hawkishDovishScore);
    if (scores.length === 0) return 0;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  });
}

function computeConsensus(rounds: RoundData[]): number {
  if (rounds.length === 0) return 0;
  const lastRound = rounds[rounds.length - 1];
  const scores = lastRound.reactions.map((r) => r.hawkishDovishScore);
  if (scores.length < 2) return 1;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length;
  const stddev = Math.sqrt(variance);
  // Normalize: stddev of 0 = full consensus, stddev >= 0.8 = max divergence
  return Math.max(0, Math.min(1, 1 - stddev / 0.8));
}

app.get('/simulations', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) return void res.status(401).json({ error: 'Unauthorized' });

  const list = Array.from(simStore.values())
    .filter((s) => s.userId === authUser.userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((s) => ({
      simulationId: s.simulationId,
      eventTitle: s.eventTitle,
      status: s.status,
      currentRound: s.currentRound,
      totalRounds: s.totalRounds,
      createdAt: s.createdAt,
      trajectory: computeTrajectory(s.rounds),
      consensus: computeConsensus(s.rounds),
    }));
  res.json(list);
});

app.get('/simulations/:id', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) return void res.status(401).json({ error: 'Unauthorized' });

  const sim = simStore.get(req.params.id);
  if (!sim || sim.userId !== authUser.userId) return void res.status(404).json({ error: 'Simulation not found' });

  res.json({
    simulationId: sim.simulationId,
    status: sim.status,
    currentRound: sim.currentRound,
    totalRounds: sim.totalRounds,
    event: { title: sim.eventTitle, summary: sim.eventSummary },
    rounds: sim.rounds,
    crisisEvents: sim.crisisEvents,
    error: sim.error,
  });
});

// ── Crisis injection ──────────────────────────────────────────────────────────

app.post('/simulations/:id/crisis', (req: Request, res: Response) => {
  const sim = simStore.get(req.params.id);
  if (!sim) return void res.status(404).json({ error: 'Simulation not found' });
  if (sim.status === 'complete') return void res.status(409).json({ error: 'Simulation already complete' });
  if (sim.status === 'failed') return void res.status(409).json({ error: 'Simulation has failed' });

  const { crisisText } = (req.body ?? {}) as { crisisText?: string };
  if (!crisisText || crisisText.trim().length === 0) {
    return void res.status(400).json({ error: 'crisisText is required and must be non-empty' });
  }

  sim.pendingCrisis = crisisText.trim();
  res.json({ acknowledged: true });
});

// ── Graph ─────────────────────────────────────────────────────────────────────

app.get('/graph/subgraph', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) return void res.status(401).json({ error: 'Unauthorized' });

  // Filter graph to nodes/edges belonging to this user's simulations
  const userSimIds = new Set(
    [...simStore.values()]
      .filter((s) => s.userId === authUser.userId)
      .map((s) => s.simulationId)
  );

  const userNodes = localGraph.nodes.filter((n) => {
    if (n.nodeType === 'topic') return userSimIds.has((n.metadata?.simulationId as string) ?? '');
    if (n.nodeType === 'dealer') return true; // dealers are shared
    // concern/crisis nodes: keep if any of their edges connect to this user's topics
    return true;
  });

  const userNodeIds = new Set(userNodes.map((n) => n.nodeId));
  const userEdges = localGraph.edges.filter(
    (e) => userNodeIds.has(e.sourceNodeId) && userNodeIds.has(e.targetNodeId)
  );

  res.json({ nodes: userNodes, edges: userEdges });
});

// ── Graph queries ─────────────────────────────────────────────────────────────

app.post('/graph/queries', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) return void res.status(401).json({ error: 'Unauthorized' });

  const { naturalLanguage, operation, params, explanation, resultSummary } = (req.body ?? {}) as {
    naturalLanguage?: string;
    operation?: string;
    params?: Record<string, unknown>;
    explanation?: string;
    resultSummary?: string;
  };

  if (!naturalLanguage || !operation) {
    return void res.status(400).json({ error: 'naturalLanguage and operation are required' });
  }

  const record: GraphQueryRecord = {
    queryId: generateId(),
    userId: authUser.userId,
    createdAt: new Date().toISOString(),
    naturalLanguage,
    operation,
    params: params ?? {},
    explanation: explanation ?? '',
    resultSummary: resultSummary ?? '',
  };

  graphQueryStore.push(record);
  saveDb();
  res.status(201).json(record);
});

app.get('/graph/queries', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) return void res.status(401).json({ error: 'Unauthorized' });

  const userQueries = graphQueryStore
    .filter((q) => q.userId === authUser.userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50);

  res.json({ queries: userQueries });
});

app.delete('/graph/queries/:queryId', (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) return void res.status(401).json({ error: 'Unauthorized' });

  const { queryId } = req.params;
  const idx = graphQueryStore.findIndex((q) => q.queryId === queryId && q.userId === authUser.userId);
  if (idx === -1) return void res.status(404).json({ error: 'Query not found' });

  graphQueryStore.splice(idx, 1);
  saveDb();
  res.json({ deleted: true });
});

// ── Simulations (create + orchestrate) ───────────────────────────────────────

app.post('/simulations', async (req: Request, res: Response) => {
  const authUser = getAuthUser(req);
  if (!authUser) return void res.status(401).json({ error: 'Unauthorized' });

  const { eventText, eventId, title, config } = (req.body ?? {}) as {
    eventText?: string;
    eventId?: string;
    title?: string;
    config?: { maxRounds?: number; enableCrisisInjection?: boolean; crisisText?: string };
  };

  if (!eventText && !eventId) {
    return void res.status(400).json({ error: 'Either eventText or eventId is required' });
  }

  const totalRounds = Math.min(5, Math.max(3, config?.maxRounds ?? 3));
  const simulationId = generateId();
  const personaIds = ['gs', 'jpm', 'ms', 'citi', 'bofa'];
  const now = new Date().toISOString();

  const sim: LocalSimulation = {
    simulationId,
    userId: authUser.userId,
    title: title ?? 'Untitled Simulation',
    status: 'running',
    currentRound: 0,
    totalRounds,
    personaIds,
    eventTitle: title ?? 'Market Event',
    eventSummary: (eventText ?? '').slice(0, 200),
    eventText: eventText ?? '',
    rounds: [],
    crisisEvents: [],
    pendingCrisis: (config?.enableCrisisInjection && config.crisisText) ? config.crisisText.trim() : null,
    createdAt: now,
    completedAt: null,
    error: null,
  };

  simStore.set(simulationId, sim);
  saveDb();
  res.status(202).json({ simulationId });

  runSimulation(sim).catch((err) => {
    console.error(`Simulation ${simulationId} failed:`, err);
    sim.status = 'failed';
    sim.error = err instanceof Error ? err.message : String(err);
    saveDb();
  });
});

// ── Simulation orchestrator ───────────────────────────────────────────────────

async function runDealerAgents(
  simulationId: string,
  personaIds: string[],
  roundNumber: number,
  roundType: 'initial' | 'peer_response' | 'crisis_reevaluation',
  eventContext: { eventId: string; eventText: string; eventSummary: string; eventDate?: string },
  peerReactions?: DealerAgentOutput[],
  crisisText?: string,
): Promise<DealerAgentOutput[]> {
  const peerReactionInputs = peerReactions?.map((p) => {
    const persona = loadPersona(p.personaId);
    return {
      personaId: p.personaId,
      personaName: persona.name,
      ratePathView: p.reaction.ratePathView,
      balanceSheetView: p.reaction.balanceSheetView,
      riskAssetView: p.reaction.riskAssetView,
      keyConcerns: p.reaction.keyConcerns,
      hawkishDovishScore: p.reaction.hawkishDovishScore,
      confidence: p.reaction.confidence,
      reasoningMd: p.reaction.reasoningMd,
      keyQuote: p.reaction.keyQuote,
    };
  });

  const inputs: DealerAgentInput[] = personaIds.map((personaId) => ({
    personaId,
    simulationId,
    roundNumber,
    roundType,
    eventContext,
    peerReactions: peerReactionInputs,
    crisisEvent: crisisText
      ? { crisisId: generateId(), crisisText, injectedAfterRound: roundNumber - 1 }
      : undefined,
  }));

  return Promise.all(inputs.map((input) => dealerAgentHandler(input)));
}

function accumulateGraph(sim: LocalSimulation): void {
  const topicId = `topic:${sim.simulationId}`;
  if (!localGraph.nodes.find((n) => n.nodeId === topicId)) {
    localGraph.nodes.push({ nodeId: topicId, nodeType: 'topic', label: sim.eventTitle, metadata: { simulationId: sim.simulationId } });
  }

  for (const round of sim.rounds) {
    for (const reaction of round.reactions) {
      const dealerId = `dealer:${reaction.personaId}`;
      const persona = loadPersona(reaction.personaId);
      const existingDealer = localGraph.nodes.find((n) => n.nodeId === dealerId);
      if (!existingDealer) {
        localGraph.nodes.push({
          nodeId: dealerId,
          nodeType: 'dealer',
          label: persona.shortName,
          metadata: {
            hdScores: [reaction.hawkishDovishScore],
            avgHawkishDovishScore: reaction.hawkishDovishScore,
            simulationCount: 1,
          },
        });
      } else {
        const meta = existingDealer.metadata as { hdScores: number[]; avgHawkishDovishScore: number; simulationCount: number };
        if (!meta.hdScores) meta.hdScores = [];
        meta.hdScores.push(reaction.hawkishDovishScore);
        meta.avgHawkishDovishScore = parseFloat((meta.hdScores.reduce((a, b) => a + b, 0) / meta.hdScores.length).toFixed(3));
        meta.simulationCount = (meta.simulationCount ?? 0) + 1;
      }
      if (!localGraph.edges.find((e) => e.sourceNodeId === topicId && e.targetNodeId === dealerId)) {
        localGraph.edges.push({ sourceNodeId: topicId, targetNodeId: dealerId, edgeType: 'topic', weight: 1 });
      }
      for (const concern of reaction.keyConcerns ?? []) {
        // Truncate concern to first 4 words max — they arrive as full sentences from the LLM
        const shortLabel = concern.split(/\s+/).slice(0, 4).join(' ');
        const normalized = shortLabel.toLowerCase().trim().replace(/\s+/g, '-');
        const concernId = `concern:${normalized}`;
        const existing = localGraph.nodes.find((n) => n.nodeId === concernId);
        if (!existing) {
          localGraph.nodes.push({
            nodeId: concernId,
            nodeType: 'concern',
            label: shortLabel,
            metadata: { frequency: 1, category: 'macro', dealerIds: [reaction.personaId] },
          });
        } else {
          // Update frequency and dealerIds on each mention
          const meta = existing.metadata as { frequency: number; category: string; dealerIds: string[] };
          meta.frequency = (meta.frequency ?? 0) + 1;
          if (!meta.dealerIds) meta.dealerIds = [];
          if (!meta.dealerIds.includes(reaction.personaId)) meta.dealerIds.push(reaction.personaId);
        }
        if (!localGraph.edges.find((e) => e.sourceNodeId === dealerId && e.targetNodeId === concernId)) {
          localGraph.edges.push({ sourceNodeId: dealerId, targetNodeId: concernId, edgeType: 'concern', weight: 1 });
        }
      }
      for (const influencer of reaction.influencedBy ?? []) {
        const src = `dealer:${influencer}`;
        if (!localGraph.edges.find((e) => e.sourceNodeId === src && e.targetNodeId === dealerId && e.edgeType === 'influence')) {
          localGraph.edges.push({ sourceNodeId: src, targetNodeId: dealerId, edgeType: 'influence', weight: Math.abs(reaction.positionShift ?? 0) });
        }
      }
    }
  }
}

// Rebuild graph from all completed simulations on startup
(function rebuildGraphOnStartup() {
  let rebuilt = 0;
  for (const sim of simStore.values()) {
    if (sim.status === 'complete') {
      accumulateGraph(sim);
      rebuilt++;
    }
  }
  if (rebuilt > 0) {
    saveDb();
    console.log(`Startup graph rebuild: ${rebuilt} simulation(s) → ${localGraph.nodes.length} nodes, ${localGraph.edges.length} edges`);
  }
})();

async function runSimulation(sim: LocalSimulation): Promise<void> {
  const eventContext = {
    eventId: sim.simulationId,
    eventText: sim.eventText,
    eventSummary: sim.eventSummary,
    eventDate: new Date().toISOString().split('T')[0],
  };

  let prevRoundOutputs: DealerAgentOutput[] = [];

  for (let round = 1; round <= sim.totalRounds; round++) {
    let roundType: 'initial' | 'peer_response' | 'crisis_reevaluation' = round === 1 ? 'initial' : 'peer_response';
    let crisisText: string | undefined;

    if (sim.pendingCrisis && round > 1) {
      crisisText = sim.pendingCrisis;
      roundType = 'crisis_reevaluation';
      sim.pendingCrisis = null;
      sim.crisisEvents.push({ crisisId: generateId(), crisisText, injectedAfterRound: round - 1, injectedAt: new Date().toISOString() });
    }

    sim.currentRound = round;
    console.log(`[${sim.simulationId}] Round ${round}/${sim.totalRounds} (${roundType}) — running 5 dealers in parallel`);

    const outputs = await runDealerAgents(
      sim.simulationId,
      sim.personaIds,
      round,
      roundType,
      eventContext,
      prevRoundOutputs.length ? prevRoundOutputs : undefined,
      crisisText,
    );

    const reactions: ReactionData[] = outputs.map((o) => ({
      personaId: o.personaId,
      status: o.status,
      ratePathView: o.reaction.ratePathView,
      balanceSheetView: o.reaction.balanceSheetView,
      riskAssetView: o.reaction.riskAssetView,
      keyConcerns: o.reaction.keyConcerns,
      hawkishDovishScore: o.reaction.hawkishDovishScore,
      confidence: o.reaction.confidence,
      reasoningMd: o.reaction.reasoningMd,
      positionShift: o.reaction.positionShift ?? null,
      influencedBy: o.reaction.influencedBy ?? [],
      keyQuote: o.reaction.keyQuote ?? null,
    }));

    sim.rounds.push({ roundNumber: round, roundType, reactions });
    prevRoundOutputs = outputs;
    console.log(`[${sim.simulationId}] Round ${round} complete`);
  }

  sim.status = 'complete';
  sim.completedAt = new Date().toISOString();
  accumulateGraph(sim);
  saveDb();
  console.log(`[${sim.simulationId}] Simulation complete`);
}

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`MarketBuzz local server running on http://localhost:${PORT}`);
  console.log(`IS_LOCAL=true | Bedrock via SSO | Tavily key: ${process.env.TAVILY_API_KEY ? 'set' : 'MISSING'}`);
});
