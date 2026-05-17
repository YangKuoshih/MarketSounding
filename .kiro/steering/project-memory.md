---
inclusion: auto
---

# MarketSounding Project Memory and Session State

## READ THIS FIRST ON EVERY NEW SESSION

This file is the persistent memory for the MarketSounding project. When starting a new session or after context compaction, read this file to understand where we are without asking the user to repeat anything.

## Project Summary

MarketSounding is a MiroFish-style multi-agent market reaction simulator where 5 primary dealer personas (GS, JPM, MS, Citi, BofA) react to market events through multi-round roundtable interactions. Dealers see each other's positions and update their views across 3-5 rounds, forming opinion clusters.

## Current Status (as of 2026-05-16)

| Phase | Status |
|-------|--------|
| Infrastructure (Terraform) | DONE — but PRE-DEPLOY FIXES PENDING (see "Pre-Deploy Fixes Required" below) |
| Backend Services (10 Lambdas) | DONE — but 4 BUGS FOUND (see Pre-Deploy Fixes) |
| Frontend (8 pages, 4 D3 viz components) | DONE — but 2 BUGS FOUND |
| Property tests | 74 backend + 6 contrast = 80 passing |
| E2E tests | 60 Playwright tests passing |
| AWS Deployment | NOT STARTED — blocked on pre-deploy fixes |

**TOTAL: 134/134 tests passing locally**, but a code review found bugs that must be fixed before AWS deploy.

## CRITICAL: Pre-Deploy Fixes Required (mid-progress when memory was updated)

A pre-deployment code review (3 parallel reviewer agents) found 9 issues. We were in the middle of fixing them when chat was reset. Status:

### P0 (deployment blockers) — FIXED in code, NOT YET TESTED
- [x] **P0-A: API Gateway integrations were all `type = "MOCK"`** — Fixed: refactored `terraform/modules/api-gateway/main.tf` to use `AWS_PROXY` integrations. Each route now wires to the correct Lambda invoke ARN. Removed the now-redundant `method_response`/`integration_response` blocks (Lambda controls response shape with AWS_PROXY).
- [x] **P0-B: No `aws_lambda_permission` resources** — Fixed: added `aws_lambda_permission "api_gateway_invoke"` for_each loop over distinct lambda function names in `terraform/modules/api-gateway/main.tf`.
- [x] **P0-A2: api_gateway module wasn't receiving Lambda ARNs** — Fixed: added 12 new variables to `terraform/modules/api-gateway/variables.tf` and wired them in `terraform/main.tf` from `module.lambda.*_invoke_arn` and `*_function_name` outputs.
- [x] **P0-A3: Deployment trigger needed update** — Added chat resources + `"aws_proxy_integrations_v2"` salt to the redeployment hash so terraform apply creates a new deployment.

### P0 (deployment blockers) — STILL TODO
- [ ] **P0-C: complete-simulation Lambda env var mismatch** — `terraform/modules/lambda/main.tf:526` sets `GRAPH_BUILDER_FUNC_NAME` but `backend/lambdas/simulation/complete.ts:14` reads `GRAPH_BUILDER_FUNCTION_NAME`. Also missing `TRANSCRIPT_BUCKET_NAME` env var that `complete.ts:15` reads.
- [ ] **P0-D: simulation-kickoff Lambda missing env vars** — `terraform/modules/lambda/main.tf:260-266` doesn't include `ROUNDS_TABLE_NAME` or `REACTIONS_TABLE_NAME`, but `backend/lambdas/simulation/kickoff.ts:26-27` reads them.

### P1 (correctness/security) — STILL TODO
- [ ] **P1-E: crisis.ts missing user ownership check** — `backend/lambdas/simulation/crisis.ts:46-62` loads simulation but never checks `simulation.userId === session.userId`. Any authenticated user can inject a crisis into any other user's simulation.
- [ ] **P1-F: graph-builder invalid Query operation** — `backend/lambdas/graph-builder/index.ts:246-251` uses `QueryCommand` with `KeyConditionExpression: 'nodeId > :empty'` on a partition-key-only table. Must change to `ScanCommand`.
- [ ] **P1-G: Bedrock model IDs may be invalid** — Code uses `anthropic.claude-opus-4-7` and `anthropic.claude-haiku-4-5` (in `dealer-agent/index.ts:20`, `chat-agent/index.ts:31-33`, `research/synthesizer.ts:7`). The query-generator.ts uses the correct format `anthropic.claude-3-5-haiku-20241022`. Verify via AWS Bedrock console for the target region and update if needed. Note the user wants Opus 4.7 (latest); the actual Bedrock ID format may differ.

### P2 (frontend) — STILL TODO
- [ ] **P2-H: chat page hydration mismatch** — `frontend/src/app/chat/page.tsx` lines 101, 105, 114, 117, 134, 138, 161, 165, 176, 180 use `Date.now()` during render (in `selectAgent()` which is called on mount). Fix by using a constant placeholder timestamp and setting real timestamps in `useEffect`.
- [ ] **P2-I: chat history filter is fragile** — `frontend/src/app/chat/page.tsx:150-157` uses `priorMessages.slice(1)` to skip intro. Breaks if user switches agents mid-conversation. Fix: filter by `m.id.startsWith('intro-')` instead.

### P3 (verification)
- [ ] **P3-J: re-run all tests** — After all fixes: `cd backend && npx vitest run` (expect 74 pass) and `cd frontend && npx playwright test` (expect 60 pass).

### NOTE on the P1-F (graph-builder Query) review finding
The reviewer flagged `cacheGraphToS3()` at line 246. Verify the table actually has only a partition key. Quick `Read` of `terraform/modules/dynamodb/main.tf` will confirm — if so, change the QueryCommand to ScanCommand. The graph-reader Lambda already uses Scan correctly.

### NOTE on roundNumber type mismatch (review item #1)
The backend reviewer also flagged a potential roundNumber type mismatch between rounds (string padded "001") and reactions (number). This is one to investigate but I'm not 100% sure it's a real bug — confirm by checking the actual writes in `write-round.ts` and the table definitions.

## Key Architecture Decisions (FINAL — do not re-ask)

| Decision | Choice |
|----------|--------|
| Frontend framework | Next.js 15 (static export to S3 + CloudFront) |
| Animation library | Framer Motion (motion/react) NOT Anime.js |
| Charting | D3.js (knowledge graph, position evolution, H/D spectrum, sparklines) |
| Icons | Lucide React ONLY — ZERO EMOJIS EVER |
| Theme | Light + dark mode (both fully supported) |
| Typography | Fira Code (data/monospace) + Fira Sans (UI text) |
| Components | shadcn/ui patterns with Tailwind CSS 4 |
| Backend | AWS Lambda (Node.js 20.x, TypeScript) |
| Orchestration | AWS Step Functions (multi-round state machine) |
| Database | DynamoDB (7 tables) |
| Storage | S3 (documents + frontend static assets) |
| CDN | CloudFront (OAC to S3, SPA routing via 404→/index.html) |
| API | API Gateway REST (CORS: wildcard allow all origins) |
| LLM | Claude Opus 4.7 via Bedrock (primary), Haiku (utility + chat) |
| Agent memory | AWS Bedrock AgentCore Memory |
| Web search | Tavily API |
| Auth | Simple DynamoDB + bcrypt + JWT (24h expiry, HS256) |
| IaC | Terraform (modular structure) |
| Testing | Vitest + fast-check (backend), Playwright (frontend E2E) |
| Hosting | S3 + CloudFront (NOT Amplify) |
| CORS | Access-Control-Allow-Origin: * |

## File Inventory

### Backend Lambdas (10 functions)

| Lambda | Path | Routes |
|--------|------|--------|
| auth | backend/lambdas/auth/index.ts | POST /auth/{register,login} |
| research | backend/lambdas/research/index.ts | POST /events/research, GET /events/samples (no auth), GET /personas (no auth) |
| simulation-kickoff | backend/lambdas/simulation/kickoff.ts | POST /simulations, GET /simulations, GET /simulations/{id} |
| init-simulation | backend/lambdas/simulation/init.ts | Step Functions task |
| write-round | backend/lambdas/simulation/write-round.ts | Step Functions task |
| complete-simulation | backend/lambdas/simulation/complete.ts | Step Functions task |
| crisis | backend/lambdas/simulation/crisis.ts | POST /simulations/{id}/crisis (currently routed via simulation-kickoff Lambda; uses Task Token pattern) |
| dealer-agent | backend/lambdas/dealer-agent/index.ts | Step Functions task (Bedrock invocation) |
| graph-builder | backend/lambdas/graph-builder/index.ts | Async post-simulation (also handles POST /graph/rebuild) |
| graph-reader | backend/lambdas/graph-reader/index.ts | GET /graph/subgraph, GET /graph/nodes/{id} |
| chat-agent | backend/lambdas/chat-agent/index.ts | POST /chat/{personaId} (Bedrock conversational, defaults to Haiku) |

### Frontend Pages

Marketing layout (MarketingShell):
- `/` Landing page (hero + features + workflow + dealer panel + CTA)
- `/about` About page (mission + tech stack + disclaimer)
- `/auth/login`, `/auth/register`

Standalone:
- `/chat` Agent chat (5 dealer picker + chat interface, wired to real backend with mock fallback)

Console layout (ConsoleShell):
- `/console` Dashboard (hero search + sample events + recent soundings)
- `/console/sounding/new` New Sounding wizard (3-tab input, real API + demo fallback)
- `/console/sounding/[id]` Simulation view (running with logs / complete with viz)
  - Pre-rendered: `demo`, `running`
  - Other IDs work via CloudFront 404→index.html SPA fallback
- `/console/graph` Knowledge graph (D3 force-directed, real API + demo fallback)
- `/console/history` Simulation archive (real API + demo fallback)

### Components Inventory

Layouts:
- `components/marketing/{marketing-shell,marketing-header,marketing-footer}.tsx`
- `components/console/{console-shell,console-header}.tsx`
- `components/theme-provider.tsx` (light/dark via class strategy on <html>)

Visualizations (D3):
- `components/viz/hd-spectrum.tsx`
- `components/viz/position-evolution.tsx`
- `components/viz/dealer-table.tsx`
- `components/viz/knowledge-graph.tsx`
- `components/viz/sparkline.tsx`

### Frontend API Client

`frontend/src/lib/api-client.ts` exposes:
- `api.auth.{register,login}`
- `api.events.{research,samples}`
- `api.simulations.{create,get,list,injectCrisis}`
- `api.graph.subgraph()`
- `api.personas.list()`
- `api.chat.send(personaId, messages)` — NEW

JWT in localStorage as `ms-token`. 401 clears token + redirects to /auth/login.
Reads `NEXT_PUBLIC_API_URL` for base URL. When unset, frontend pages fall back to demo data.

### Terraform Modules

```
terraform/
  main.tf                          # Root: wires all modules
  variables.tf, outputs.tf, versions.tf
  environments/{dev,prod}.tfvars
  modules/
    dynamodb/                      # 7 tables: users, events, simulations, rounds, reactions, graph_nodes, graph_edges
    s3/                            # Documents bucket
    api-gateway/                   # REST API + CORS + rate limit + AWS_PROXY integrations + lambda permissions (FIXED)
    lambda/                        # 10 Lambda functions + IAM (4 NEW: graph-reader, chat-agent + 2 fixes pending)
    step-functions/                # 13-state ASL state machine
    bedrock/                       # Model access config
    cloudfront/                    # Frontend CDN + S3 + OAC + 404→/index.html for SPA
    secrets/                       # JWT secret (auto-generated 64 char) + Tavily key placeholder (NEW)
```

### Test Suite

Backend (`cd backend && npx vitest run`) — 74 tests:
- 13 auth (Properties 16-19): bcrypt, JWT, credential indistinguishability, validation
- 13 dealer-agent (Properties 4, 6, 11-15): round 1 independence, self-exclusion, prompt construction, score bounding, structure, position shift, peer metadata
- 5 research (Properties 1, 2): result filtering, citation completeness
- 10 simulation orchestration (Properties 5, 7, 8, 9, 10): sequential persistence, graceful degradation, convergence calc, threshold termination, crisis context
- 5 transcript (Properties 24, 25, 26): completeness, anchor/swing, clusters
- 17 graph helpers (Properties 20, 21): correlation threshold, edge aggregation, jaccard, normalize/classify
- 11 input/scope/auth (Properties 3, 23, 27): 50KB boundary, user-scoped queries, unauth uniformity

Frontend (`cd frontend && npx playwright test`) — 60 tests:
- 11 smoke (all routes return 200, no console errors)
- 9 landing page interactions
- 6 agent chat flow (mock mode)
- 17 console + new sounding + simulation view + history
- 5 D3 knowledge graph
- 4 theme toggle
- 6 WCAG AA contrast (Property 22)

Run all: `cd backend && npx vitest run && cd ../frontend && npx playwright test`

### Deployment Scripts

- `backend/scripts/deploy-lambdas.sh` — esbuild bundle + lambda update-function-code per function (10 lambdas)
- `frontend/scripts/deploy.sh` — build + S3 sync (with cache headers) + CloudFront invalidation
- README.md has full deploy walkthrough

## How to Resume the Pre-Deploy Fix Work

Pick up where we left off. The remaining items are:

1. **Fix P0-C** in `terraform/modules/lambda/main.tf` around line 522-528:
   - Rename `GRAPH_BUILDER_FUNC_NAME` to `GRAPH_BUILDER_FUNCTION_NAME`
   - Add `TRANSCRIPT_BUCKET_NAME = var.documents_bucket_name`

2. **Fix P0-D** in `terraform/modules/lambda/main.tf` around line 260-266 (simulation_kickoff env vars):
   - Add `ROUNDS_TABLE_NAME = var.rounds_table_name`
   - Add `REACTIONS_TABLE_NAME = var.reactions_table_name`
   - Verify the lambda module already accepts these as variables (`var.rounds_table_name`, `var.reactions_table_name`). If not, add them to `variables.tf` and wire from root `main.tf`.

3. **Fix P1-E** in `backend/lambdas/simulation/crisis.ts` after line 62, add:
   ```typescript
   if (simulation.userId !== session.userId) {
     return notFound('Simulation not found');
   }
   ```

4. **Fix P1-F** in `backend/lambdas/graph-builder/index.ts` lines 246-251, replace QueryCommand with ScanCommand:
   ```typescript
   const nodesResult = await ddbClient.send(new ScanCommand({
     TableName: GRAPH_NODES_TABLE,
   }));
   ```
   (Make sure to import ScanCommand if not already.)

5. **Verify P1-G Bedrock model IDs** — User wants Claude Opus 4.7 (the latest). Check AWS Bedrock console for the actual model identifier. Update if needed in:
   - `backend/lambdas/dealer-agent/index.ts:20`
   - `backend/lambdas/chat-agent/index.ts:31,33`
   - `backend/lambdas/research/synthesizer.ts:7`

6. **Fix P2-H** in `frontend/src/app/chat/page.tsx` — Replace `Date.now()` calls in `selectAgent()` with `0` placeholder, then set real timestamps in `useEffect`.

7. **Fix P2-I** in `frontend/src/app/chat/page.tsx:150-157` — Replace `priorMessages.slice(1)` with `priorMessages.filter(m => !m.id.startsWith('intro-'))`.

8. **Re-run tests** — `cd backend && npx vitest run` and `cd frontend && npx playwright test`. Both should still pass.

9. **Then proceed to AWS deployment** (Task 19):
   - `cd terraform && terraform init && terraform plan -var-file=environments/dev.tfvars`
   - `terraform apply -var-file=environments/dev.tfvars`
   - `aws secretsmanager update-secret --secret-id marketsounding-dev/tavily-api-key --secret-string "$TAVILY_KEY"`
   - `cd backend && ./scripts/deploy-lambdas.sh marketsounding-dev`
   - `cd frontend && NEXT_PUBLIC_API_URL=$API_URL FRONTEND_BUCKET=$BUCKET CLOUDFRONT_DISTRIBUTION_ID=$DIST_ID ./scripts/deploy.sh`
   - Smoke test on the CloudFront URL

## Spec Files Location

- Design: `.kiro/specs/marketsounding-hackathon/design.md`
- Requirements: `.kiro/specs/marketsounding-hackathon/requirements.md`
- Tasks: `.kiro/specs/marketsounding-hackathon/tasks.md`
- Project status: `.kiro/steering/project-status.md`

## User Preferences (DO NOT re-ask)

- HATES emojis — never use them anywhere (in code, UI, comments)
- Wants professional, financial-grade UI (investment platform aesthetic)
- Prefers AWS-native services
- Uses AWS SSO for authentication
- Wants CORS open so APIs work from any origin
- Chose Framer Motion over Anime.js for cleaner React integration
- Chose Next.js over plain React (for shadcn/ui compatibility + file routing)
- Chose static export over SSR (simpler, all logic in API Gateway)
- Chose CloudFront over Amplify (more control)
- This is for a crunch-a-thon (time-constrained)
- Inspired by MiroFish demo console structure
- Wants header-based navigation (NOT sidebar)
- Wants light + dark mode fully supported

## Hooks Active

1. ui-design-system (userTriggered) — Run design system generator on demand
2. ui-design-review (fileCreated on components/**/*.tsx, app/**/*.tsx) — Auto-review new UI files

## Steering Files

1. `.kiro/steering/ui-design-standards.md` — UI/UX rules (fileMatch on *.tsx)
2. `.kiro/steering/project-memory.md` — THIS FILE (auto-included every session)
3. `.kiro/steering/project-status.md` — At-a-glance status with route inventory

## Survey Data Insights (from NY Fed SPD Mar 2026)

- Median fed funds target: 3.63% (suggesting market expects policy easing)
- Core PCE 2026: 2.7% (pctl25: 2.6%, pctl75: 2.8%)
- Core PCE 2027: 2.3% (converging toward target)
- 59 respondents in panel (Combined: Primary Dealers + Market Participants)
- Data covers: rate expectations, inflation paths, employment, real GDP growth, SEP medians
- Located in: `docs/sample survey results/`
