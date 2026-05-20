# Local Bedrock Dev Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mock server at `localhost:3001` with a real Express server that calls AWS Bedrock (Sonnet 4.6) via local SSO credentials, enabling live demo of all 6 AI agents.

**Architecture:** A single `backend/local-server.ts` Express app imports and reuses all existing Lambda handlers, persona profiles, prompt builders, and parsers unchanged. In-memory Maps replace DynamoDB and Step Functions. A `getSecret()` fallback reads `TAVILY_API_KEY` from `.env.local` instead of Secrets Manager. An in-process session state store replaces the DynamoDB-backed one when `IS_LOCAL=true`.

**Tech Stack:** Express, cors, dotenv, tsx (TS runner), existing AWS SDK Bedrock client (SSO credential chain), Tavily API, existing Lambda handler code

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `backend/lib/secrets.ts` | Add env-var fallback so `TAVILY_API_KEY` is read from `.env.local` locally |
| Modify | `backend/lib/session-state.ts` | Add in-memory store when `IS_LOCAL=true` |
| Modify | `backend/package.json` | Add `express`, `cors`, `dotenv`, `tsx`, `@types/express`, `@types/cors` |
| Create | `backend/local-server.ts` | Express server: auth passthrough, Lambda adapters, simulation orchestrator, in-memory store |
| Modify | `backend/.gitignore` | Ensure `.env.local` is ignored (verify only) |

---

## Task 1: Install dependencies

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Add runtime and dev dependencies**

Open `backend/package.json`. Add to `dependencies`:
```json
"cors": "^2.8.5",
"dotenv": "^16.4.5",
"express": "^4.19.2"
```

Add to `devDependencies`:
```json
"@types/cors": "^2.8.17",
"@types/express": "^4.17.21",
"tsx": "^4.19.2"
```

Add to `scripts`:
```json
"dev": "tsx local-server.ts"
```

The final `scripts` block should look like:
```json
"scripts": {
  "build": "tsc --build",
  "test": "vitest run",
  "test:watch": "vitest",
  "dev": "tsx local-server.ts"
}
```

- [ ] **Step 2: Install**

```bash
cd backend && npm install
```

Expected: installs without errors, `node_modules/express` and `node_modules/tsx` appear.

- [ ] **Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore: add express, cors, dotenv, tsx for local dev server"
```

---

## Task 2: Patch `secrets.ts` — env-var fallback for Tavily

**Files:**
- Modify: `backend/lib/secrets.ts`

The Tavily client calls `getSecret(TAVILY_API_KEY_ARN)`. Locally `TAVILY_API_KEY_ARN` is not set (empty string), so we need `getSecret('')` to return `process.env.TAVILY_API_KEY` instead of hitting Secrets Manager.

- [ ] **Step 1: Add the fallback at the top of `getSecret`**

Open `backend/lib/secrets.ts`. Replace the existing `export async function getSecret` with:

```ts
export async function getSecret(secretArn: string): Promise<string> {
  // Local dev: if no ARN provided, read from env var directly
  if (!secretArn) {
    const envKey = process.env.TAVILY_API_KEY ?? '';
    if (envKey) return envKey;
    throw new Error('No secret ARN and no TAVILY_API_KEY env var set');
  }

  const cached = secretCache.get(secretArn);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  const command = new GetSecretValueCommand({ SecretId: secretArn });
  const response = await secretsClient.send(command);

  if (!response.SecretString) {
    throw new Error(`Secret ${secretArn} has no string value`);
  }

  secretCache.set(secretArn, {
    value: response.SecretString,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return response.SecretString;
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors for `lib/secrets.ts`.

- [ ] **Step 3: Commit**

```bash
git add backend/lib/secrets.ts
git commit -m "feat: add env-var fallback to getSecret for local dev"
```

---

## Task 3: Patch `session-state.ts` — in-memory store when `IS_LOCAL=true`

**Files:**
- Modify: `backend/lib/session-state.ts`

The dealer agent calls `loadSessionState` and `saveSessionState` which hit DynamoDB. We intercept these when `IS_LOCAL=true` and use a module-level `Map` instead.

- [ ] **Step 1: Add the in-memory store and branch both functions**

Open `backend/lib/session-state.ts`. Add the store after the imports and before any function definitions:

```ts
// In-memory store for local dev (IS_LOCAL=true bypasses DynamoDB)
const localSessionStore = new Map<string, DealerSessionState>();
```

Then modify `loadSessionState` to add the branch at the very top of the function (before the DynamoDB try/catch):

```ts
export async function loadSessionState(
  simulationId: string,
  personaId: string
): Promise<DealerSessionState> {
  if (process.env.IS_LOCAL === 'true') {
    return localSessionStore.get(`${simulationId}#${personaId}`) ?? createEmptySession(simulationId, personaId);
  }

  try {
    // ... existing DynamoDB code unchanged
```

Then modify `saveSessionState` to add the branch at the very top:

```ts
export async function saveSessionState(state: DealerSessionState): Promise<void> {
  if (process.env.IS_LOCAL === 'true') {
    localSessionStore.set(`${state.simulationId}#${state.personaId}`, state);
    return;
  }

  await docClient.send(
    // ... existing DynamoDB code unchanged
```

- [ ] **Step 2: Verify the file compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/lib/session-state.ts
git commit -m "feat: add in-memory session state store for local dev"
```

---

## Task 4: Create `local-server.ts` — auth routes and Express scaffold

**Files:**
- Create: `backend/local-server.ts`

Build the server in stages. This task: scaffold + auth routes only.

- [ ] **Step 1: Create the file with imports, env setup, and auth routes**

Create `backend/local-server.ts`:

```ts
import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

// Stub env vars so existing Lambda code doesn't throw on missing process.env references
process.env.IS_LOCAL = 'true';
process.env.USERS_TABLE_NAME = 'local-users';
process.env.SIMULATIONS_TABLE_NAME = 'local-simulations';
process.env.EVENTS_TABLE_NAME = 'local-events';
process.env.ROUNDS_TABLE_NAME = 'local-rounds';
process.env.REACTIONS_TABLE_NAME = 'local-reactions';
process.env.GRAPH_NODES_TABLE_NAME = 'local-graph-nodes';
process.env.GRAPH_EDGES_TABLE_NAME = 'local-graph-edges';
process.env.STATE_MACHINE_ARN = '';
process.env.JWT_SECRET_ARN = '';

const app = express();
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json({ limit: '2mb' }));

const JWT_SECRET = process.env.JWT_SECRET ?? 'local-dev-secret-not-for-production';
const DEMO_USER = { userId: 'local-user-1', username: 'demo' };

function makeToken(): string {
  return jwt.sign(DEMO_USER, JWT_SECRET, { algorithm: 'HS256', expiresIn: '24h' });
}

// ── Auth ──────────────────────────────────────────────────────────────────────

app.post('/auth/login', (_req: Request, res: Response) => {
  res.json({ success: true, token: makeToken(), userId: DEMO_USER.userId });
});

app.post('/auth/register', (_req: Request, res: Response) => {
  res.status(201).json({ success: true, token: makeToken(), userId: DEMO_USER.userId });
});

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`MarketSounding local server running on http://localhost:${PORT}`);
  console.log(`IS_LOCAL=true | Bedrock via SSO | Tavily key: ${process.env.TAVILY_API_KEY ? 'set' : 'MISSING'}`);
});
```

- [ ] **Step 2: Verify it starts**

```bash
cd backend && npm run dev
```

Expected output:
```
MarketSounding local server running on http://localhost:3001
IS_LOCAL=true | Bedrock via SSO | Tavily key: set
```

Press `Ctrl+C` to stop.

- [ ] **Step 3: Commit**

```bash
git add backend/local-server.ts
git commit -m "feat: local server scaffold with auth passthrough"
```

---

## Task 5: Add research, personas, and sample event routes

**Files:**
- Modify: `backend/local-server.ts`

These routes delegate to the existing `lambdas/research/index.ts` handler by constructing a minimal Lambda event object and unwrapping the response.

- [ ] **Step 1: Add a Lambda event adapter helper and the three routes**

Add this to `backend/local-server.ts` after the auth routes and before the `app.listen` call:

```ts
import { handler as researchHandler } from './lambdas/research/index';

// Helper: wrap Express req into the minimal Lambda event shape the handlers need
function lambdaEvent(req: Request, overrides: Record<string, unknown> = {}) {
  return {
    httpMethod: req.method,
    path: req.path,
    headers: req.headers as Record<string, string>,
    pathParameters: req.params as Record<string, string>,
    queryStringParameters: req.query as Record<string, string>,
    body: req.body ? JSON.stringify(req.body) : null,
    ...overrides,
  } as import('aws-lambda').APIGatewayProxyEvent;
}

// Helper: send a Lambda result as an Express response
function sendLambdaResult(res: Response, result: import('aws-lambda').APIGatewayProxyResult) {
  res.status(result.statusCode).json(JSON.parse(result.body));
}

// ── Research / events ─────────────────────────────────────────────────────────

app.get('/events/samples', async (req: Request, res: Response) => {
  const result = await researchHandler(lambdaEvent(req));
  sendLambdaResult(res, result);
});

app.post('/events/research', async (req: Request, res: Response) => {
  const result = await researchHandler(lambdaEvent(req));
  sendLambdaResult(res, result);
});

app.get('/personas', async (req: Request, res: Response) => {
  const result = await researchHandler(lambdaEvent(req));
  sendLambdaResult(res, result);
});
```

- [ ] **Step 2: Start the server and test samples endpoint**

```bash
cd backend && npm run dev
```

In a second terminal:
```bash
curl http://localhost:3001/events/samples
```

Expected: JSON array of sample events (the same ones from `backend/data/events/samples.ts`).

- [ ] **Step 3: Test personas endpoint**

```bash
curl http://localhost:3001/personas
```

Expected: JSON array with 5 personas (gs, jpm, ms, citi, bofa).

- [ ] **Step 4: Commit**

```bash
git add backend/local-server.ts
git commit -m "feat: add research, samples, and personas routes to local server"
```

---

## Task 6: Add chat route (Jarrett + dealer chat)

**Files:**
- Modify: `backend/local-server.ts`

The chat handler uses `withAuth` middleware which validates the JWT. We pass our demo token through the Authorization header shape it expects.

- [ ] **Step 1: Add the chat route**

Add to `backend/local-server.ts` after the personas route and before `app.listen`:

```ts
import { handler as chatHandler } from './lambdas/chat-agent/index';

// ── Chat ──────────────────────────────────────────────────────────────────────

app.post('/chat/:personaId', async (req: Request, res: Response) => {
  const token = makeToken();
  const result = await (chatHandler as Function)(
    lambdaEvent(req, {
      pathParameters: { personaId: req.params.personaId },
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  sendLambdaResult(res, result);
});
```

- [ ] **Step 2: Verify the chat route calls Bedrock**

Ensure your AWS SSO session is active:
```bash
aws sso login --profile <your-profile>
```

Start the server and send a test chat message:
```bash
cd backend && npm run dev
```

In a second terminal:
```bash
curl -X POST http://localhost:3001/chat/gs \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What is your view on the next FOMC meeting?"}]}'
```

Expected: JSON with `reply` field containing a Goldman Sachs-voiced response from Bedrock (not a mock). Takes 3-8 seconds.

- [ ] **Step 3: Commit**

```bash
git add backend/local-server.ts
git commit -m "feat: add live chat route to local server (Bedrock Haiku)"
```

---

## Task 7: Add in-memory simulation store and GET routes

**Files:**
- Modify: `backend/local-server.ts`

Before wiring up the simulation orchestrator, define the in-memory store and read routes so the frontend can poll.

- [ ] **Step 1: Add the in-memory store types and maps**

Add near the top of `backend/local-server.ts` after the imports:

```ts
import type { SimulationView, RoundData, ReactionData } from './lambdas/simulation/kickoff';

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

const simStore = new Map<string, LocalSimulation>();

// In-memory graph accumulated from completed simulations
const localGraph: {
  nodes: Array<{ nodeId: string; nodeType: string; label: string; metadata: Record<string, unknown> }>;
  edges: Array<{ sourceNodeId: string; targetNodeId: string; edgeType: string; weight: number }>;
} = { nodes: [], edges: [] };
```

- [ ] **Step 2: Add GET simulation routes and graph route**

Add after the chat route and before `app.listen`:

```ts
import { loadAllPersonas } from './data/personas';

// ── Simulations (read) ────────────────────────────────────────────────────────

app.get('/simulations', (_req: Request, res: Response) => {
  const list = Array.from(simStore.values()).map((s) => ({
    simulationId: s.simulationId,
    eventTitle: s.eventTitle,
    status: s.status,
    currentRound: s.currentRound,
    totalRounds: s.totalRounds,
    createdAt: s.createdAt,
  }));
  res.json(list);
});

app.get('/simulations/:id', (req: Request, res: Response) => {
  const sim = simStore.get(req.params.id);
  if (!sim) return res.status(404).json({ error: 'Simulation not found' });

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

// ── Graph ─────────────────────────────────────────────────────────────────────

app.get('/graph/subgraph', (_req: Request, res: Response) => {
  res.json({ nodes: localGraph.nodes, edges: localGraph.edges });
});
```

- [ ] **Step 3: Verify list and get routes work**

```bash
curl http://localhost:3001/simulations
```

Expected: `[]` (empty array — no simulations yet).

- [ ] **Step 4: Commit**

```bash
git add backend/local-server.ts
git commit -m "feat: add in-memory simulation store and read routes"
```

---

## Task 8: Add simulation orchestrator (POST /simulations)

**Files:**
- Modify: `backend/local-server.ts`

This is the core: replaces Step Functions with an in-process async loop that runs dealer agents in parallel per round.

- [ ] **Step 1: Add the dealer agent runner helper**

Add after the `simStore` definition:

```ts
import { handler as dealerAgentHandler } from './lambdas/dealer-agent/index';
import type { DealerAgentInput, DealerAgentOutput } from './lambdas/dealer-agent/types';
import { loadPersona } from './data/personas';

function generateId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 12);
}

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

  const results = await Promise.all(inputs.map((input) => dealerAgentHandler(input)));
  return results;
}
```

- [ ] **Step 2: Add the graph accumulator helper**

Add after `runDealerAgents`:

```ts
function accumulateGraph(sim: LocalSimulation): void {
  // Topic node
  const topicId = `topic:${sim.simulationId}`;
  if (!localGraph.nodes.find((n) => n.nodeId === topicId)) {
    localGraph.nodes.push({ nodeId: topicId, nodeType: 'topic', label: sim.eventTitle, metadata: { simulationId: sim.simulationId } });
  }

  for (const round of sim.rounds) {
    for (const reaction of round.reactions) {
      // Dealer node
      const dealerId = `dealer:${reaction.personaId}`;
      if (!localGraph.nodes.find((n) => n.nodeId === dealerId)) {
        localGraph.nodes.push({ nodeId: dealerId, nodeType: 'dealer', label: reaction.personaId, metadata: {} });
      }
      // Topic → dealer edge
      if (!localGraph.edges.find((e) => e.sourceNodeId === topicId && e.targetNodeId === dealerId)) {
        localGraph.edges.push({ sourceNodeId: topicId, targetNodeId: dealerId, edgeType: 'topic', weight: 1 });
      }
      // Concern nodes + edges
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
      // Influence edges
      for (const influencer of reaction.influencedBy ?? []) {
        localGraph.edges.push({ sourceNodeId: `dealer:${influencer}`, targetNodeId: dealerId, edgeType: 'influence', weight: Math.abs(reaction.positionShift ?? 0) });
      }
    }
  }
}
```

- [ ] **Step 3: Add the POST /simulations route with the orchestrator**

Add after the graph route and before `app.listen`:

```ts
// ── Simulations (create + orchestrate) ───────────────────────────────────────

app.post('/simulations', async (req: Request, res: Response) => {
  const { eventText, eventId, title } = req.body ?? {};

  if (!eventText && !eventId) {
    return res.status(400).json({ error: 'Either eventText or eventId is required' });
  }

  const simulationId = generateId();
  const personaIds = ['gs', 'jpm', 'ms', 'citi', 'bofa'];
  const now = new Date().toISOString();

  const sim: LocalSimulation = {
    simulationId,
    userId: DEMO_USER.userId,
    title: title ?? 'Untitled Simulation',
    status: 'running',
    currentRound: 0,
    totalRounds: 3,
    personaIds,
    eventTitle: title ?? 'Market Event',
    eventSummary: eventText?.slice(0, 200) ?? '',
    eventText: eventText ?? '',
    rounds: [],
    crisisEvents: [],
    pendingCrisis: null,
    createdAt: now,
    completedAt: null,
    error: null,
  };

  simStore.set(simulationId, sim);

  // Return immediately — orchestration runs async
  res.status(202).json({ simulationId });

  // Run simulation in background (no await)
  runSimulation(sim).catch((err) => {
    console.error(`Simulation ${simulationId} failed:`, err);
    sim.status = 'failed';
    sim.error = err instanceof Error ? err.message : String(err);
  });
});

async function runSimulation(sim: LocalSimulation): Promise<void> {
  const eventContext = {
    eventId: sim.simulationId,
    eventText: sim.eventText,
    eventSummary: sim.eventSummary,
    eventDate: new Date().toISOString().split('T')[0],
  };

  let prevRoundOutputs: DealerAgentOutput[] = [];

  for (let round = 1; round <= sim.totalRounds; round++) {
    const roundType = round === 1 ? 'initial' : 'peer_response';

    // Check for crisis injection between rounds
    let crisisText: string | undefined;
    if (sim.pendingCrisis && round > 1) {
      crisisText = sim.pendingCrisis;
      sim.pendingCrisis = null;
      const crisisId = generateId();
      sim.crisisEvents.push({ crisisId, crisisText, injectedAfterRound: round - 1, injectedAt: new Date().toISOString() });
    }

    sim.currentRound = round;
    console.log(`[${sim.simulationId}] Round ${round}/${sim.totalRounds} (${crisisText ? 'crisis_reevaluation' : roundType}) — running 5 dealers in parallel`);

    const outputs = await runDealerAgents(
      sim.simulationId,
      sim.personaIds,
      round,
      crisisText ? 'crisis_reevaluation' : roundType,
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

    sim.rounds.push({
      roundNumber: round,
      roundType: crisisText ? 'crisis_reevaluation' : roundType,
      reactions,
    });

    prevRoundOutputs = outputs;
    console.log(`[${sim.simulationId}] Round ${round} complete`);
  }

  sim.status = 'complete';
  sim.completedAt = new Date().toISOString();
  accumulateGraph(sim);
  console.log(`[${sim.simulationId}] Simulation complete`);
}
```

- [ ] **Step 4: Verify the types import — add missing type**

`RoundData` and `ReactionData` are defined in `frontend/src/lib/api-client.ts` for the frontend, but we need local versions. Add these type definitions near the top of `local-server.ts` (after imports):

```ts
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
```

Remove the import line `import type { SimulationView, RoundData, ReactionData } from './lambdas/simulation/kickoff';` added in Task 7 Step 1 — those types don't exist in that file.

- [ ] **Step 5: Check TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Fix any type errors before committing. Common issues:
- `DealerAgentOutput` import: it's in `./lambdas/dealer-agent/types`
- `handler` from `dealer-agent/index.ts` is not `withAuth`-wrapped, so it can be called directly

- [ ] **Step 6: Test a full simulation end-to-end**

Ensure SSO session is active (`aws sso login --profile <your-profile>`), then:

```bash
cd backend && npm run dev
```

In a second terminal:
```bash
# Create a simulation
curl -X POST http://localhost:3001/simulations \
  -H "Content-Type: application/json" \
  -d '{"eventText":"The Federal Reserve held rates steady at 4.25-4.5% at the May 2026 FOMC meeting, citing persistent inflation above target and resilient labor markets.","title":"May 2026 FOMC Hold"}'
```

Expected: `{"simulationId":"<id>"}` returned immediately.

Watch the server logs — you should see:
```
[<id>] Round 1/3 (initial) — running 5 dealers in parallel
[<id>] Round 1 complete
[<id>] Round 2/3 (peer_response) — running 5 dealers in parallel
...
[<id>] Simulation complete
```

Poll the result:
```bash
curl http://localhost:3001/simulations/<id>
```

Expected: JSON with `status: "complete"` and `rounds` array containing 3 rounds, each with 5 dealer reactions.

- [ ] **Step 7: Commit**

```bash
git add backend/local-server.ts
git commit -m "feat: add simulation orchestrator with live Bedrock dealer agents"
```

---

## Task 9: Add crisis injection route

**Files:**
- Modify: `backend/local-server.ts`

Crisis injection stores the crisis text on the simulation and the orchestrator picks it up between rounds.

- [ ] **Step 1: Add the crisis route**

Add after the `GET /simulations/:id` route and before the graph route:

```ts
// ── Crisis injection ──────────────────────────────────────────────────────────

app.post('/simulations/:id/crisis', (req: Request, res: Response) => {
  const sim = simStore.get(req.params.id);
  if (!sim) return res.status(404).json({ error: 'Simulation not found' });
  if (sim.status === 'complete') return res.status(409).json({ error: 'Simulation already complete' });
  if (sim.status === 'failed') return res.status(409).json({ error: 'Simulation has failed' });

  const { crisisText } = req.body ?? {};
  if (!crisisText || typeof crisisText !== 'string' || crisisText.trim().length === 0) {
    return res.status(400).json({ error: 'crisisText is required and must be non-empty' });
  }

  sim.pendingCrisis = crisisText.trim();
  res.json({ acknowledged: true });
});
```

- [ ] **Step 2: Commit**

```bash
git add backend/local-server.ts
git commit -m "feat: add crisis injection route to local server"
```

---

## Task 10: Wire up the frontend and verify full demo flow

**Files:**
- Verify: `frontend/src/lib/api-client.ts` (read-only check — should already point to `localhost:3001`)

- [ ] **Step 1: Confirm the frontend API URL**

Open `frontend/src/lib/api-client.ts` line 1:

```ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
```

This is already correct — no changes needed.

- [ ] **Step 2: Start both servers**

Terminal 1 (backend):
```bash
cd backend && npm run dev
```

Terminal 2 (frontend):
```bash
cd frontend && npm run dev
```

- [ ] **Step 3: Test the full golden path in the browser**

Navigate to `http://localhost:3000`.

1. **Login** — go to `/auth/login`, enter any username/password, click Login. Should redirect to `/console`.
2. **Sample events** — the console page should load sample event cards from the live API.
3. **Personas** — confirm 5 dealer personas are shown.
4. **Run a simulation** — enter a topic like `"Federal Reserve holds rates at 4.5%"`, click Run. Should navigate to `/console/sounding/<id>` and show the loading state with 5 dealer avatars.
5. **Poll until complete** — the page polls `GET /simulations/:id`. Watch server logs. After ~60-120 seconds (3 rounds × ~20s per round), the status changes to `complete` and results render.
6. **Results** — H/D spectrum, dealer table with rate path / balance sheet / risk asset views, hawkish/dovish scores, and reasoning.
7. **Jarrett chat** — click the Jarrett widget (bottom right). Ask a question. Should get a live Bedrock response within ~5 seconds.
8. **Agent chat** — navigate to `/chat`, select a dealer, send a message. Should get a live response.
9. **News research** — on the new simulation form, try the research/search input with a topic. Should call Tavily and return live news synthesis.
10. **Knowledge graph** — navigate to `/console/graph` after a simulation completes. Should show nodes and edges.

- [ ] **Step 4: Commit the plan completion marker**

```bash
git add docs/superpowers/plans/2026-05-20-local-bedrock-server.md docs/superpowers/specs/2026-05-20-local-bedrock-server-design.md
git commit -m "docs: local bedrock server implementation plan and spec"
```

---

## Self-Review Notes

- **Spec §4.1 secrets.ts** — covered in Task 2 ✓
- **Spec §4.2 session-state.ts** — covered in Task 3 ✓
- **Spec §3.1 startup + env stubs** — covered in Task 4 ✓
- **Spec §3.2 auth passthrough** — covered in Task 4 ✓
- **Spec §3.3 research routes** — covered in Task 5 ✓
- **Spec §3.4 simulation orchestrator** — covered in Task 8 ✓
- **Spec §3.5 crisis injection** — covered in Task 9 ✓
- **Spec §3.6 chat + personas** — covered in Tasks 5 and 6 ✓
- **Spec §3.7 graph in-memory** — covered in Task 8 (accumulateGraph) and Task 7 (GET route) ✓
- **Spec §4.4 package.json deps** — covered in Task 1 ✓
- **`RoundData`/`ReactionData` types** — defined locally in Task 8 Step 4, not imported from kickoff.ts (which doesn't export them) ✓
- **`withAuth` on chat handler** — Task 6 passes a synthetic Bearer token so the middleware validates correctly ✓
