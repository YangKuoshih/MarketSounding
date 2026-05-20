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
import { randomUUID } from 'crypto';
import { handler as researchHandler } from './lambdas/research/index';
import { handler as chatHandler } from './lambdas/chat-agent/index';
import { handler as dealerAgentHandler } from './lambdas/dealer-agent/index';
import type { DealerAgentInput, DealerAgentOutput } from './lambdas/dealer-agent/types';
import { loadPersona } from './data/personas';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// ── Local types (mirrors frontend api-client.ts shapes) ───────────────────────

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

// ── In-memory stores ──────────────────────────────────────────────────────────

const simStore = new Map<string, LocalSimulation>();

const localGraph: {
  nodes: Array<{ nodeId: string; nodeType: string; label: string; metadata: Record<string, unknown> }>;
  edges: Array<{ sourceNodeId: string; targetNodeId: string; edgeType: string; weight: number }>;
} = { nodes: [], edges: [] };

// ── Express app ───────────────────────────────────────────────────────────────

const app = express();
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json({ limit: '2mb' }));

const JWT_SECRET = process.env.JWT_SECRET ?? 'local-dev-secret-not-for-production';
const DEMO_USER = { userId: 'local-user-1', username: 'demo' };

function makeToken(): string {
  return jwt.sign(DEMO_USER, JWT_SECRET, { algorithm: 'HS256', expiresIn: '24h' });
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

app.post('/auth/login', (_req: Request, res: Response) => {
  res.json({ success: true, token: makeToken(), userId: DEMO_USER.userId });
});

app.post('/auth/register', (_req: Request, res: Response) => {
  res.status(201).json({ success: true, token: makeToken(), userId: DEMO_USER.userId });
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
  try {
    const token = makeToken();
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

app.get('/simulations', (_req: Request, res: Response) => {
  const list = Array.from(simStore.values())
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
  const sim = simStore.get(req.params.id);
  if (!sim) return void res.status(404).json({ error: 'Simulation not found' });

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

app.get('/graph/subgraph', (_req: Request, res: Response) => {
  res.json({ nodes: localGraph.nodes, edges: localGraph.edges });
});

// ── Simulations (create + orchestrate) ───────────────────────────────────────

app.post('/simulations', async (req: Request, res: Response) => {
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
    userId: DEMO_USER.userId,
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
  res.status(202).json({ simulationId });

  runSimulation(sim).catch((err) => {
    console.error(`Simulation ${simulationId} failed:`, err);
    sim.status = 'failed';
    sim.error = err instanceof Error ? err.message : String(err);
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
      if (!localGraph.nodes.find((n) => n.nodeId === dealerId)) {
        localGraph.nodes.push({ nodeId: dealerId, nodeType: 'dealer', label: reaction.personaId, metadata: {} });
      }
      if (!localGraph.edges.find((e) => e.sourceNodeId === topicId && e.targetNodeId === dealerId)) {
        localGraph.edges.push({ sourceNodeId: topicId, targetNodeId: dealerId, edgeType: 'topic', weight: 1 });
      }
      for (const concern of reaction.keyConcerns ?? []) {
        const normalized = concern.toLowerCase().trim().replace(/\s+/g, '-');
        const concernId = `concern:${normalized}`;
        if (!localGraph.nodes.find((n) => n.nodeId === concernId)) {
          localGraph.nodes.push({ nodeId: concernId, nodeType: 'concern', label: concern, metadata: {} });
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
  console.log(`[${sim.simulationId}] Simulation complete`);
}

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`MarketSounding local server running on http://localhost:${PORT}`);
  console.log(`IS_LOCAL=true | Bedrock via SSO | Tavily key: ${process.env.TAVILY_API_KEY ? 'set' : 'MISSING'}`);
});
