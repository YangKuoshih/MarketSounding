---
name: Local Bedrock Dev Server
description: Design for local Express server that connects MarketSounding to live AWS Bedrock (Sonnet 4.6) using SSO credentials, replacing the mock server for demo purposes
status: pending-user-review
date: 2026-05-20
author: Tony Yang
---

# Local Bedrock Dev Server — Design

## 1. Goal

Replace the mock server at `localhost:3001` with a real Express server that:
- Calls AWS Bedrock (Sonnet 4.6) for all 6 AI agents (5 dealer agents + Jarrett/chat agent)
- Uses local AWS SSO credentials — no keys stored in the app
- Uses Tavily for live news search (API key stored in `backend/.env.local`, gitignored)
- Keeps the existing frontend completely unchanged (same API contract)
- Stores simulation state in-memory (no DynamoDB needed for demo)

## 2. Architecture

```
Next.js frontend (localhost:3000)
        ↓  fetch — identical API contract, no frontend changes
Express local-server.ts (localhost:3001)
        ↓  imports existing Lambda handlers & lib unchanged
  ├── /auth/login|register  → passthrough auth (fixed demo JWT, no bcrypt/DynamoDB)
  ├── /events/samples       → research handler (no change)
  ├── /events/research      → research handler
  │       ├── Tavily news search (API key from .env.local)
  │       ├── Bedrock Haiku (query generation)     ← LIVE
  │       └── Bedrock Sonnet 4.6 (synthesis)       ← LIVE
  ├── /simulations (POST)   → in-process simulation orchestrator
  │       └── dealer-agent × 5 in parallel per round (3 rounds)
  │               └── Bedrock Sonnet 4.6           ← LIVE
  ├── /simulations/:id (GET) → in-memory store
  ├── /simulations (GET)    → in-memory store
  ├── /simulations/:id/crisis (POST) → crisis injection into running sim
  ├── /chat/:personaId      → chat-agent handler   ← LIVE (Haiku)
  ├── /personas             → research handler (no change)
  └── /graph/subgraph       → in-memory graph derived from completed sims
```

## 3. New file: `backend/local-server.ts`

Single ~250-line Express server. Responsibilities:

### 3.1 Startup
- Loads `backend/.env.local` via `dotenv`
- Sets required env vars: `IS_LOCAL=true`, `JWT_SECRET`, table name stubs (so existing code doesn't throw on missing env vars)
- Starts Express on port 3001 with JSON body parser and CORS for localhost:3000

### 3.2 Auth routes (passthrough)
`POST /auth/login` and `POST /auth/register` return a fixed JWT signed with `JWT_SECRET` from env. No bcrypt, no DynamoDB. The existing `withAuth` middleware validates it fine.

### 3.3 Research routes
Delegates directly to `lambdas/research/index.ts` handler by constructing a minimal Lambda event object. The handler calls DuckDuckGo → Bedrock Haiku → Bedrock Sonnet 4.6 unchanged.

### 3.4 Simulation orchestrator
Replaces Step Functions. On `POST /simulations`:
1. Generate a simulation ID, store initial record in memory
2. Run rounds asynchronously (don't await — return `{ simulationId }` immediately so frontend can poll)
3. Round 1 (`initial`): invoke all 5 dealer agents via `Promise.all`
4. Round 2–3 (`peer_response`): invoke all 5 again, passing Round N-1 reactions as `peerReactions`
5. After all rounds: run graph builder in-process, mark simulation complete

`GET /simulations/:id` polls the in-memory store and returns the current state.

### 3.5 Crisis injection
`POST /simulations/:id/crisis` stores the crisis text in-memory. The orchestrator checks for a pending crisis between rounds and runs a `crisis_reevaluation` round if one exists.

### 3.6 Chat and personas
Delegates directly to `lambdas/chat-agent/index.ts` and the personas loader. No changes.

### 3.7 Graph
After simulation completes, the orchestrator runs a simplified inline graph accumulation directly in `local-server.ts` — it does not call `graph-builder/index.ts` (which is tightly coupled to DynamoDB and S3). Instead, it derives nodes (dealer, topic, concern) and edges (influence, concern, topic) from the in-memory reaction data and stores them in a `localGraph` object. `GET /graph/subgraph` returns from that object.

## 4. Modified files

### 4.1 `backend/lib/secrets.ts`
Add a 3-line env-var fallback at the top of `getSecret()`:

```ts
export async function getSecret(secretArn: string): Promise<string> {
  // Local dev: if no ARN is set, read directly from env
  if (!secretArn) {
    const envKey = process.env.TAVILY_API_KEY ?? '';
    if (envKey) return envKey;
  }
  // ... existing Secrets Manager code unchanged
```

The Tavily client passes `TAVILY_API_KEY_ARN` from env. Locally that env var is not set (empty string), so the fallback reads `TAVILY_API_KEY` from `.env.local` directly. Secrets Manager is never called.

### 4.2 `backend/lib/session-state.ts`
Add an in-memory store activated by `IS_LOCAL=true`:

```ts
const localSessionStore = new Map<string, DealerSessionState>();

export async function loadSessionState(...) {
  if (process.env.IS_LOCAL === 'true') {
    return localSessionStore.get(`${simulationId}#${personaId}`) ?? createEmptySession(simulationId, personaId);
  }
  // ... existing DynamoDB code unchanged
}

export async function saveSessionState(state: DealerSessionState) {
  if (process.env.IS_LOCAL === 'true') {
    localSessionStore.set(`${state.simulationId}#${state.personaId}`, state);
    return;
  }
  // ... existing DynamoDB code unchanged
}
```

### 4.3 `backend/lambdas/research/tavily-client.ts`
No change to the file itself. The `TAVILY_API_KEY_ARN` env var will be empty string locally, which triggers the `secrets.ts` fallback to read `TAVILY_API_KEY` from `.env.local`. The Tavily client works unchanged.

### 4.4 `backend/package.json`
Add dependencies:
- `express` + `@types/express`
- `cors` + `@types/cors`
- `dotenv`
- `tsx` (devDep — zero-config TypeScript execution)

Add script:
```json
"dev": "tsx local-server.ts"
```

### 4.5 `backend/.env.local` (new, gitignored)
```
IS_LOCAL=true
JWT_SECRET=local-dev-secret-not-for-production
TAVILY_API_KEY=tvly-xxxxxxxxxxxxxxxxxxxxxxxx
```
AWS credentials come from `~/.aws/` SSO tokens automatically — no AWS keys in this file.

### 4.6 `backend/.gitignore`
Add `.env.local`.

## 5. AWS credential flow

`BedrockRuntimeClient({})` with no explicit config uses the default AWS credential provider chain:
1. Checks `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` env vars
2. Falls back to `~/.aws/credentials` and `~/.aws/config`
3. SSO tokens stored by `aws sso login` are picked up automatically from `~/.aws/sso/cache/`

No changes to any Bedrock client code. Ensure `aws sso login --profile <your-profile>` has been run and the session is active before starting the server.

The AWS region used will be whatever is in `~/.aws/config` for the active profile. Bedrock must be enabled in that region (typically `us-east-1` or `us-west-2`). The Sonnet 4.6 cross-region inference profile `us.anthropic.claude-sonnet-4-6-20250514:0` routes automatically.

## 6. Models summary

| Use case | Model | File |
|---|---|---|
| Dealer reactions (×5 per round) | Sonnet 4.6 (`us.anthropic.claude-sonnet-4-6-20250514:0`) | `dealer-agent/index.ts` |
| Research synthesis | Sonnet 4.6 | `research/synthesizer.ts` |
| Search query generation | Haiku 3.5 (`anthropic.claude-3-5-haiku-20241022`) | `research/query-generator.ts` |
| Chat / Jarrett | Haiku 4.5 (default) | `chat-agent/index.ts` |

## 7. What is NOT changed

- All 5 dealer persona files (`gs.ts`, `jpm.ts`, `ms.ts`, `citi.ts`, `bofa.ts`)
- `prompt-builder.ts`, `reaction-parser.ts`, `convergence.ts`, `transcript-generator.ts`
- The entire `frontend/` directory — zero edits
- Terraform infrastructure — untouched, available for future AWS deploy

## 8. Running locally

```bash
# 1. Ensure SSO session is active
aws sso login --profile <your-profile>

# 2. Install new deps
cd backend && npm install

# 3. Create backend/.env.local (one time)
echo "IS_LOCAL=true\nJWT_SECRET=local-dev-secret-not-for-production" > .env.local

# 4. Start local server
npm run dev

# 5. In a separate terminal, start the frontend
cd frontend && npm run dev
```

Navigate to `localhost:3000` — all agents live on Bedrock via SSO.
