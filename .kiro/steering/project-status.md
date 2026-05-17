---
inclusion: auto
---

# MarketSounding Project Status

**Last updated:** 2026-05-16

## At-a-Glance

| Layer | Status | Completion |
|-------|--------|------------|
| Infrastructure (Terraform) | Code complete; **PRE-DEPLOY FIXES IN PROGRESS** | 90% |
| Backend Services (10 Lambdas) | Code complete; **4 BUGS PENDING** from review | 90% |
| Frontend Pages (UI/UX) | Code complete; **2 BUGS PENDING** from review | 95% |
| Frontend Visualizations (D3) | DONE | 100% |
| Property/Unit Tests | DONE | 100% (74 backend + 6 contrast = 80 tests) |
| E2E Tests (Playwright) | DONE | 100% (60 tests) |
| Real Chat Backend | Code complete; needs P2-H/I fixes | 90% |
| Real Knowledge Graph | DONE (wired with sample fallback) | 100% |
| Real History Page | DONE (wired with sample fallback) | 100% |
| AWS Deployment | NOT STARTED — blocked on pre-deploy fixes | 0% |

**TOTAL: 134/134 tests passing locally.** A pre-deploy review found 9 issues — 3 FIXED, 6 PENDING.

## Pre-Deploy Review Findings (CRITICAL — see project-memory.md for full detail)

A 3-agent parallel pre-deploy review found these issues:

### FIXED in code (not yet tested)
- ✅ **P0-A**: API Gateway integrations were all `MOCK` → switched to `AWS_PROXY` wired to Lambda invoke ARNs
- ✅ **P0-B**: Added `aws_lambda_permission` resources so API Gateway can invoke Lambdas
- ✅ **P0-A2**: Wired Lambda ARNs from lambda module → api_gateway module via 12 new variables

### STILL TODO (6 issues)
- 🔴 **P0-C**: complete-simulation env var name mismatch (`GRAPH_BUILDER_FUNC_NAME` should be `GRAPH_BUILDER_FUNCTION_NAME`) and missing `TRANSCRIPT_BUCKET_NAME`
- 🔴 **P0-D**: simulation-kickoff missing `ROUNDS_TABLE_NAME` and `REACTIONS_TABLE_NAME` env vars
- 🟡 **P1-E**: `crisis.ts` missing user ownership check (security bug — any user can crisis-inject any sim)
- 🟡 **P1-F**: graph-builder line 246 uses invalid `QueryCommand` with `>` on partition key — must be `ScanCommand`
- 🟡 **P1-G**: Verify Bedrock model IDs (`anthropic.claude-opus-4-7`, `anthropic.claude-haiku-4-5`) — may need real AWS Bedrock identifiers
- 🟡 **P2-H**: Chat page hydration mismatch — `Date.now()` in `selectAgent()` runs during render
- 🟡 **P2-I**: Chat history filter uses `.slice(1)` (fragile) — should filter by intro- prefix

See `.kiro/steering/project-memory.md` "Pre-Deploy Fixes Required" section for exact line numbers and fix snippets.

## What's Done

### Infrastructure (Terraform) — Tasks 1-2
- 9 modules: dynamodb, s3, api-gateway, lambda, step-functions, bedrock, cloudfront, iam, secrets
- 7 DynamoDB tables (users, events, simulations, rounds, reactions, graph_nodes, graph_edges)
- API Gateway REST API with 12 routes (incl. /chat/{personaId}), CORS *, 100 req/s rate limiting
- Step Functions multi-round state machine (13 states, Task Token crisis injection)
- CloudFront + S3 + OAC for frontend hosting (with 403/404 → /index.html SPA fallback)
- Bedrock model access (Opus 4.7 + Haiku) and AgentCore config
- Secrets Manager auto-generated JWT secret + Tavily API key placeholder

### Backend (10 Lambdas) — Tasks 3-7 + post-task work
- `auth` — register/login, bcrypt + JWT, timing-safe credential validation
- `research` — Tavily web search → Haiku queries → Opus event synthesis. Also handles GET /events/samples + GET /personas (both unauth)
- `simulation-kickoff` — POST /simulations, GET /simulations, GET /simulations/{id} (full SimulationView with rounds + reactions + event)
- `init-simulation` — Step Functions task: state initialization
- `write-round` — Step Functions task: round result persistence
- `complete-simulation` — Step Functions task: status, transcript, graph trigger
- `crisis` — POST /simulations/{id}/crisis (Task Token pattern)
- `dealer-agent` — Step Functions task: persona prompt, Bedrock Opus, reaction parsing, AgentCore Memory
- `graph-builder` — Async post-simulation: graph extraction (nodes, edges, Jaccard correlation)
- `graph-reader` — GET /graph/subgraph, GET /graph/nodes/{id} (S3 cache → DynamoDB fallback)
- `chat-agent` — POST /chat/{personaId} (Bedrock Haiku conversational, persona-grounded)
- 5 dealer persona profiles (GS, JPM, MS, Citi, BofA) — each ≥ 100 chars

### Frontend Pages — Tasks 9-16, 20
- `/` — Marketing landing page (hero, features grid, workflow, dealer panel, CTA)
- `/about` — Mission, 6-category tech stack grid, disclaimer block
- `/chat` — Agent chat (5 dealer picker, real Bedrock backend with mock fallback)
- `/console` — Dashboard with hero search, sample events, recent soundings + sparklines
- `/console/sounding/new` — 3-tab event input (Search/Paste/Sample), real API + demo fallback
- `/console/sounding/[id]` — Running view (real polling) + Complete view (D3 charts + table + transcript)
- `/console/graph` — D3 force-directed knowledge graph (real API + sample fallback)
- `/console/history` — Searchable filterable simulation list (real API + sample fallback)
- `/auth/login` + `/auth/register`
- Header-based navigation (NOT sidebar)
- MarketingShell + ConsoleShell layouts
- Light + dark mode (full WCAG AA contrast in both)
- Fira Code (data) + Fira Sans (UI) fonts
- Lucide React icons exclusively (zero emojis)

### D3 Visualizations
- `HDSpectrum` — Horizontal hawkish/dovish strip with positioned markers
- `PositionEvolution` — Multi-line chart of H/D trajectory across rounds
- `KnowledgeGraph` — Force-directed graph (4 node types, 5 edge types, drag/zoom/click-detail)
- `Sparkline` — Mini H/D trajectory for table rows

### Tests
- **Backend (vitest + fast-check):** 74 tests across 7 spec files
- **Frontend (Playwright):** 60 tests across 6 spec files
- Total: 134/134 passing locally

### Deployment Pipeline (scripts ready)
- `backend/scripts/deploy-lambdas.sh` — esbuild bundle + lambda update-function-code per function
- `frontend/scripts/deploy.sh` — build + S3 sync + CloudFront invalidation
- README.md has full walkthrough

## What's Remaining

1. **Finish pre-deploy fixes** (6 items P0-C through P2-I — see project-memory.md)
2. **Run `terraform plan`** to validate all the recent terraform changes compile
3. **Re-run `npx vitest run` and `npx playwright test`** after fixes
4. **AWS Deployment (Task 19):**
   - `cd terraform && terraform init && terraform apply -var-file=environments/dev.tfvars`
   - `aws secretsmanager update-secret --secret-id marketsounding-dev/tavily-api-key --secret-string "$KEY"`
   - `cd backend && ./scripts/deploy-lambdas.sh marketsounding-dev`
   - `cd frontend && NEXT_PUBLIC_API_URL=$URL FRONTEND_BUCKET=$B CLOUDFRONT_DISTRIBUTION_ID=$D ./scripts/deploy.sh`
   - Smoke test on the CloudFront URL

## Known Issues / Tech Debt
- Pre-deploy bugs (see top section)
- Static export only pre-renders `/console/sounding/{demo,running}` for dynamic [id] routes; real sim IDs rely on CloudFront 404→index.html SPA fallback
- Crisis routing currently shares the simulation-kickoff Lambda (defaults via local in api-gateway). Could split into a separate Lambda if isolation is needed.
- graph-builder.cacheGraphToS3 only persists nodes (not edges) currently — review if this is intended

## Bedrock Model IDs (Verify Against AWS Bedrock Console)

Currently used in code:
- `anthropic.claude-opus-4-7` (dealer-agent, chat-agent fallback, research synthesizer)
- `anthropic.claude-haiku-4-5` (chat-agent default)
- `anthropic.claude-3-5-haiku-20241022` (research query-generator — confirmed valid format)

The `claude-opus-4-7` and `claude-haiku-4-5` identifiers may need to be the actual Bedrock IDs (e.g., `anthropic.claude-opus-4-20250514-v1:0` format). Verify before deploy.
