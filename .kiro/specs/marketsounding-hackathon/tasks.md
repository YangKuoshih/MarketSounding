# Implementation Plan: marketsounding-hackathon

## Overview

Full-stack implementation of the MarketSounding multi-agent dealer simulation platform. The system is built as an AWS serverless stack (Lambda + Step Functions + API Gateway + DynamoDB + S3 + CloudFront + Bedrock + AgentCore) with Terraform IaC, and a Next.js 15 frontend statically exported to S3 and served via CloudFront. Implementation proceeds from infrastructure through backend services, then frontend, with integration wiring at the end.

## Status (as of 2026-05-16)

| Phase | Tasks | Status |
|-------|-------|--------|
| Infrastructure (Terraform) | 1.1 - 1.8, 2 | DONE |
| Backend services (Lambdas) | 3 - 8 | DONE |
| Frontend foundation + pages | 9 - 16 | DONE |
| Frontend redesign (post-MVP) | 20 | DONE |
| Frontend checkpoint | 17 | DONE |
| Integration wiring (frontend ↔ API) | 18 | DONE |
| Final verification | 19 | PENDING (deploy + smoke test) |

Property tests (3.4, 4.3, 5.5, 6.7, 7.3, 9.5, 12.3, 16.2, 16.3) are marked optional (`*`) and skipped for hackathon scope.

## Tasks

- [x] 1. Terraform infrastructure foundation
  - [x] 1.1 Set up Terraform project structure with provider configuration
    - Create `terraform/` directory with `main.tf`, `variables.tf`, `outputs.tf`, `versions.tf`
    - Configure AWS provider (~> 5.0) and random provider (~> 3.0)
    - Create `environments/dev.tfvars` and `environments/prod.tfvars` with environment-specific variables
    - Define shared variables: region, environment, project name prefix
    - _Requirements: 15.1, 15.4_

  - [x] 1.2 Implement DynamoDB module with all tables and GSIs
    - Create `terraform/modules/dynamodb/` with tables: users, events, simulations, rounds, reactions, graph_nodes, graph_edges
    - Configure partition keys, sort keys, and GSIs as specified in the data model (username-index, userId-createdAt-index, status-index, simulationId-index)
    - Set billing mode to PAY_PER_REQUEST for all tables
    - Enable encryption at rest (AWS-managed keys) on all tables
    - _Requirements: 15.2, 15.5_

  - [x] 1.3 Implement S3 module for document storage
    - Create `terraform/modules/s3/` with private bucket (no public access)
    - Configure SSE-S3 encryption, versioning, and lifecycle rules
    - Block all public access (block_public_acls, block_public_policy, ignore_public_acls, restrict_public_buckets)
    - _Requirements: 15.5_

  - [x] 1.4 Implement API Gateway module with rate limiting and CORS
    - Create `terraform/modules/api-gateway/` with REST API definition
    - Configure rate limiting (100 req/s per IP) via usage plan and throttling
    - Configure CORS with `Access-Control-Allow-Origin: *` so API endpoints work from any origin (CloudFront, custom domain, localhost, etc.)
    - Enforce TLS 1.2+ for all traffic
    - Define resource paths for auth, events, simulations, graph endpoints
    - _Requirements: 15.3, 15.5, 19.5_

  - [x] 1.5 Implement Lambda module for all functions
    - Create `terraform/modules/lambda/` with function definitions: auth, research, simulation-kickoff, dealer-agent, write-round, init-simulation, complete-simulation, graph-builder
    - Configure IAM roles with least-privilege policies (DynamoDB, S3, Bedrock, Step Functions, Secrets Manager access)
    - Set memory (512MB), timeout (60s for dealer-agent, 30s for others), and runtime (nodejs20.x)
    - Configure environment variables (table names, bucket name, JWT secret ARN)
    - _Requirements: 15.1_

  - [x] 1.6 Implement Step Functions module with state machine definition
    - Create `terraform/modules/step-functions/` with ASL definition for multi-round simulation
    - Define states: InitializeSimulation, ExecuteRound1 (Map), WriteRound1, CheckMoreRounds, WaitForCrisisOrContinue, WaitForCrisis (waitForTaskToken), ExecuteCrisisRound (Map), ExecutePeerRound (Map), WritePeerRound, CheckConvergence, IncrementRound, CompleteSimulation
    - Configure error handling and retry policies on Lambda invocations
    - Set WaitForCrisis timeout to 120 seconds with States.Timeout catch
    - _Requirements: 15.1, 3.1, 3.2, 5.1_

  - [x] 1.7 Implement Bedrock and AgentCore module
    - Create `terraform/modules/bedrock/` with model access configuration for Claude Opus 4.7 and Haiku
    - Configure AgentCore agent definitions for 5 dealer personas
    - Set up AgentCore Memory configuration for per-dealer session state
    - _Requirements: 15.1_

  - [x] 1.8 Implement CloudFront + S3 module for frontend hosting
    - Create `terraform/modules/cloudfront/` with CloudFront distribution
    - Create S3 bucket for static frontend assets (private, OAC access only)
    - Configure Origin Access Control (OAC) so CloudFront is the only way to access S3
    - Set up default root object (index.html) and custom error responses (404 â†’ index.html for SPA routing)
    - Configure cache behaviors: static assets (long TTL), HTML (short TTL or no-cache)
    - Output the CloudFront distribution URL and domain name
    - Add the CloudFront URL to API Gateway CORS allowed origins
    - _Requirements: 15.1_

- [x] 2. Checkpoint â€” Validate Terraform configuration
  - Run `terraform validate` and `terraform plan` to ensure all modules are syntactically correct and resources are properly linked. Ask the user if questions arise.

- [x] 3. Backend core: Authentication service
  - [x] 3.1 Implement auth Lambda with register and login handlers
    - Create `backend/lambdas/auth/` with handler for POST /auth/register and POST /auth/login
    - Implement password hashing with bcrypt (10 rounds)
    - Implement JWT token issuance (HS256, 24h expiry) using jsonwebtoken
    - Implement timing-safe credential validation (hash even when user not found)
    - Return identical error message "Invalid credentials" for both wrong username and wrong password
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 3.2 Implement auth middleware for token validation
    - Create shared `backend/lib/auth-middleware.ts` for JWT validation on protected routes
    - Return 401 Unauthorized without revealing resource existence for invalid/expired tokens
    - Extract userId and username from valid tokens for downstream use
    - _Requirements: 8.5, 19.1, 19.4_

  - [x] 3.3 Implement input validation for auth endpoints
    - Validate username: 3-50 characters, alphanumeric + underscore only
    - Validate password: minimum 8 characters
    - Use zod schemas for request body validation
    - _Requirements: 8.6, 19.3_

  - [ ]* 3.4 Write property tests for authentication
    - **Property 16: Password Hash Format** â€” For any valid password, stored hash is valid bcrypt (60 chars, $2b$ prefix)
    - **Property 17: JWT Token Properties** â€” Token has 24h expiry, HS256 algorithm; expired tokens are rejected
    - **Property 18: Credential Error Indistinguishability** â€” Invalid credentials return identical error regardless of failure reason
    - **Property 19: Username and Password Validation** â€” Username accepts iff 3-50 chars alphanumeric+underscore; password accepts iff >= 8 chars
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.5, 8.6, 19.3**

- [x] 4. Backend core: Event Research Agent
  - [x] 4.1 Implement research Lambda with Tavily integration
    - Create `backend/lambdas/research/` with handler for POST /events/research
    - Implement search query generation using Haiku (2-3 query variants from user topic)
    - Integrate Tavily API for web search execution
    - Implement result filtering by recency and relevance
    - Synthesize top 3-5 sources into structured Event brief using Opus 4.7
    - Return source citations (title, URL, snippet, published date, domain, relevance score)
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 4.2 Implement event caching and error handling
    - Cache recent topic searches in DynamoDB events table to avoid redundant API calls
    - Handle Tavily API failures: return descriptive error suggesting user try different topic or paste text directly
    - Handle zero-result searches gracefully
    - _Requirements: 1.4, 1.5_

  - [ ]* 4.3 Write property tests for research agent
    - **Property 1: Search Result Filtering** â€” Filter returns only top 3-5 results ranked by recency and relevance
    - **Property 2: Source Citation Completeness** â€” Every source has all required fields with non-empty values
    - **Validates: Requirements 1.2, 1.3**

- [x] 5. Backend core: Dealer Agent and reaction processing
  - [x] 5.1 Implement dealer agent Lambda with persona loading and prompt construction
    - Create `backend/lambdas/dealer-agent/` with handler invoked by Step Functions
    - Load persona profile from AgentCore Memory (or fallback to static profiles)
    - Implement `buildDealerPrompt()` for all three round types: initial, peer_response, crisis_reevaluation
    - Construct Bedrock messages with persona profile, event context, and round-appropriate peer context
    - Ensure peer reactions exclude the current dealer's own prior reaction
    - _Requirements: 6.1, 6.2, 6.4_

  - [x] 5.2 Implement reaction parsing and validation
    - Create `backend/lib/reaction-parser.ts` with `parseReactionResponse()` function
    - Clamp hawkishDovishScore to [-1, +1] regardless of LLM output
    - Clamp confidence to [0, 1] regardless of LLM output
    - Validate keyConcerns has 1-3 items and reasoningMd is non-empty
    - Verify positionShift equals arithmetic difference between current and prior H/D scores (within 0.001 tolerance)
    - Implement retry logic: one retry with more explicit prompt on malformed JSON or missing fields
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 5.3 Implement AgentCore Memory integration for session state
    - Store updated dealer state in AgentCore Memory after each round
    - Maintain position history and influence tracking across simulation session
    - Structure session memory: personaProfile, priorRoundReactions, peerSummaries, positionHistory, keyInfluences
    - _Requirements: 6.5, 17.1, 17.2, 17.3_

  - [x] 5.4 Define persona profiles for all 5 dealers
    - Create `backend/data/personas/` with detailed profiles for GS, JPM, MS, Citi, BofA
    - Include characteristic biases, analytical frameworks, named economists, typical positioning
    - Each profile >= 100 chars of markdown content
    - _Requirements: 6.1, 6.3_

  - [ ]* 5.5 Write property tests for dealer agent
    - **Property 4: Round 1 Independence** â€” All Round 1 invocations have null/empty peer reactions
    - **Property 6: Self-Exclusion from Peer Context** â€” Dealer D never sees own reaction in peer context
    - **Property 11: Prompt Construction Completeness** â€” Prompt contains persona profile (>=100 chars), event text (<=12000 chars), round-appropriate peer context
    - **Property 12: Reaction Score Bounding** â€” hawkishDovishScore clamped to [-1,+1], confidence clamped to [0,1]
    - **Property 13: Reaction Structure Validation** â€” Parsed reaction has all required fields with valid values
    - **Property 14: Position Shift Arithmetic** â€” positionShift equals current minus prior H/D score within 0.001
    - **Property 15: Peer Response Metadata Completeness** â€” influencedBy contains only valid persona IDs, keyQuote is non-empty
    - **Validates: Requirements 3.1, 3.3, 6.2, 7.1, 7.2, 7.3, 7.4, 17.1, 17.2, 17.3**

- [x] 6. Backend core: Simulation orchestration Lambdas
  - [x] 6.1 Implement simulation kickoff Lambda
    - Create `backend/lambdas/simulation/` with handler for POST /simulations
    - Create simulation record in DynamoDB with status "running"
    - Start Step Functions execution with simulation config payload
    - Return 202 with simulationId
    - _Requirements: 3.1_

  - [x] 6.2 Implement init-simulation Lambda (Step Functions task)
    - Initialize simulation state: set currentRound=1, validate persona IDs, load event data
    - Create AgentCore Memory sessions for each dealer
    - _Requirements: 3.1_

  - [x] 6.3 Implement write-round Lambda (Step Functions task)
    - Write round results to DynamoDB rounds and reactions tables after each round completes
    - Update simulation record with currentRound progress
    - Handle partial results (some dealers failed)
    - _Requirements: 3.6, 3.5_

  - [x] 6.4 Implement convergence detection
    - Create `backend/lib/convergence.ts` with `calculateConvergence()` function
    - Calculate average absolute H/D score delta across all non-failed dealers
    - Return 1.0 if no valid comparison pairs exist
    - Exclude failed dealers from calculation
    - _Requirements: 4.1, 4.3, 4.4_

  - [x] 6.5 Implement complete-simulation Lambda
    - Update simulation status to "complete" with completedAt timestamp
    - Trigger knowledge graph builder (async invocation)
    - Generate discussion transcript and store in S3
    - _Requirements: 3.4_

  - [x] 6.6 Implement crisis injection endpoint and Task Token handling
    - Create handler for POST /simulations/{id}/crisis
    - Call Step Functions SendTaskSuccess with crisis event data
    - Return 409 if simulation already complete
    - Handle concurrent crisis injections (Task Token pattern ensures only first accepted)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 6.7 Write property tests for simulation orchestration
    - **Property 5: Sequential Round Execution with Persistence** â€” Round rK persisted before r(K+1) begins
    - **Property 7: Graceful Degradation on Dealer Failure** â€” Simulation completes with remaining dealers, failed dealers have status "failed"
    - **Property 8: Convergence Calculation Correctness** â€” Score equals average absolute H/D delta; returns 1.0 if no valid pairs
    - **Property 9: Convergence-Based Termination** â€” No further rounds if score < threshold; rounds continue if score >= threshold
    - **Property 10: Crisis Round Context Completeness** â€” Crisis round receives original event, crisis text, and all prior positions
    - **Validates: Requirements 3.2, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 5.2**

- [x] 7. Backend core: Transcript generation and knowledge graph
  - [x] 7.1 Implement transcript generator
    - Create `backend/lib/transcript-generator.ts`
    - Produce markdown-formatted document organized by round
    - Include each dealer's reasoning, position shifts, influence attributions, and key quotes per round
    - Identify and label "anchor" dealer (least total movement) and "swing" dealer (most total movement)
    - Include cluster analysis showing aligned dealers and outliers
    - _Requirements: 18.1, 18.2, 18.3, 18.4_

  - [x] 7.2 Implement knowledge graph builder Lambda
    - Create `backend/lambdas/graph-builder/` triggered after simulation completion
    - Extract graph data: topic nodes, dealer-topic edges, influence edges, concern nodes, concern edges
    - Compute topic correlation edges using Jaccard similarity (threshold > 0.3)
    - Update dealer node aggregates (avgHawkishDovishScore, simulationCount, topConcerns)
    - Aggregate parallel influence edges into single weighted edge when > 50 simulations exist
    - Cache full graph JSON in S3 for fast frontend retrieval
    - _Requirements: 10.6, 11.1, 11.2, 11.3, 11.4_

  - [ ]* 7.3 Write property tests for transcript and graph
    - **Property 20: Graph Extraction and Correlation Threshold** â€” Produces correct edges; correlation edges iff Jaccard > 0.3
    - **Property 21: Edge Aggregation** â€” Parallel edges aggregated when > 50 simulations
    - **Property 24: Transcript Completeness** â€” N round sections, M dealer entries each with required fields
    - **Property 25: Anchor and Swing Dealer Identification** â€” Anchor has min total shift, swing has max total shift
    - **Property 26: Cluster Analysis Correctness** â€” Dealers within proximity threshold grouped together
    - **Validates: Requirements 10.6, 11.3, 18.1, 18.2, 18.3, 18.4**

- [x] 8. Checkpoint â€” Backend services complete
  - Ensure all Lambda handlers compile, unit tests pass, and property tests pass. Verify Terraform plan includes all resources. Ask the user if questions arise.

- [x] 9. Frontend foundation: Next.js 15 project setup
  - [x] 9.1 Initialize Next.js 15 project with TypeScript and Tailwind CSS 4
    - Create `frontend/` directory with Next.js 15 app router structure
    - Configure TypeScript, Tailwind CSS 4, and path aliases
    - Configure `next.config.ts` with `output: 'export'` for static site generation (no SSR â€” all API calls go to API Gateway)
    - Install dependencies: shadcn/ui, d3, motion, lucide-react, zod, nanoid
    - Remove AWS SDK clients from frontend (all backend calls go through API Gateway via fetch)
    - Configure Fira Code and Fira Sans fonts (Google Fonts or self-hosted)
    - Add build script: `next build` produces static output in `out/` directory for S3 upload
    - Configure environment variable `NEXT_PUBLIC_API_URL` pointing to API Gateway URL
    - _Requirements: 13.2_

  - [x] 9.2 Implement theme system with light and dark mode
    - Create theme tokens matching design spec (light and dark color palettes)
    - Implement system preference detection and manual toggle (Sun/Moon Lucide icons)
    - Configure Tailwind CSS dark mode with class strategy
    - Ensure WCAG-compliant color contrast (4.5:1 normal text, 3:1 large text) in both themes
    - _Requirements: 13.1, 13.6_

  - [x] 9.3 Implement global shell: sidebar navigation and top bar
    - Create collapsible sidebar with Lucide icons and text labels: Home (LayoutDashboard), New Sounding (Plus), Knowledge Graph (Network), History (Clock)
    - Create top bar with app logo/name (left), theme toggle + user avatar dropdown (right)
    - Create persistent disclaimer banner: "Simulated views â€” not actual dealer commentary" with AlertTriangle icon
    - _Requirements: 14.1, 14.2, 13.7_

  - [x] 9.4 Set up API client layer for calling API Gateway
    - Create `frontend/lib/api-client.ts` with typed fetch wrappers for all API Gateway endpoints (auth, events, simulations, graph, personas)
    - Use `NEXT_PUBLIC_API_URL` environment variable as base URL
    - Implement JWT token management (store in localStorage, attach as Bearer token on all requests)
    - Handle 401 responses with redirect to login page
    - Implement request/response error handling with typed error responses
    - _Requirements: 8.5, 19.1_

  - [ ]* 9.5 Write property test for theme contrast compliance
    - **Property 22: WCAG Color Contrast Compliance** â€” All text-on-background pairs meet WCAG AA thresholds in both themes
    - **Validates: Requirement 13.6**

- [x] 10. Frontend: Authentication pages
  - [x] 10.1 Implement login and register pages
    - Create `/auth/login` and `/auth/register` pages with shadcn form components
    - Implement client-side validation (username 3-50 chars alphanumeric+underscore, password >= 8 chars)
    - Handle auth errors with consistent messaging
    - Store JWT token on successful auth, redirect to dashboard
    - _Requirements: 8.2, 8.6, 19.3_

- [x] 11. Frontend: Dashboard and Home page
  - [x] 11.1 Implement Home/Dashboard page
    - Create hero search input: "What's happening in the markets?" with Search Lucide icon
    - Create sample event cards (3) with Lucide icons (Newspaper, TrendingUp, Globe) + title + mini-summary
    - Create recent soundings table with status badges (CheckCircle, Loader, XCircle icons)
    - Implement Framer Motion staggered card reveal animation (300ms, 50ms stagger, easeOutCubic)
    - _Requirements: 14.3, 13.5_

- [x] 12. Frontend: New Sounding page with event input modes
  - [x] 12.1 Implement three-tab event input (Search / Paste / Sample)
    - Create tabbed interface with Lucide icons (Search, ClipboardPaste, BookOpen)
    - Search tab: topic input field triggering research API call
    - Paste tab: textarea accepting raw text up to 50KB with client-side size validation
    - Sample tab: grid of pre-configured sample events
    - _Requirements: 2.1, 2.2, 2.3, 19.2_

  - [x] 12.2 Implement research results display and simulation configuration
    - Display synthesized event brief with source citations (ExternalLink icons, domain badges)
    - Show edit capability (Pencil icon) for event text
    - Create simulation config panel: dealer chips (toggleable), round count slider (3-5), crisis injection toggle
    - Create launch button (amber CTA with Rocket icon)
    - Display event brief for user confirmation before launching simulation
    - _Requirements: 2.4, 1.3_

  - [ ]* 12.3 Write property test for input validation
    - **Property 3: Input Size Boundary Validation** â€” Accept strings <= 50KB, reject strings > 50KB
    - **Validates: Requirements 2.2, 19.2**

- [x] 13. Frontend: Simulation View page (running state)
  - [x] 13.1 Implement simulation progress tracking UI
    - Create progress bar with round counter (current round / total rounds)
    - Create dealer avatar circles with completion indicators (CheckCircle for complete, Loader for running)
    - Implement Framer Motion dealer completion pulse animation (400ms, easeOutElastic)
    - Implement 2-second polling interval for simulation status updates
    - _Requirements: 12.1, 12.2, 12.4, 13.5_

  - [x] 13.2 Implement crisis injection UI
    - Create crisis injection textarea (visible only when crisis injection enabled and simulation running)
    - Add submit button with Zap icon
    - Implement Framer Motion shake + amber flash animation on inject (400ms, easeOutElastic)
    - Handle 409 Conflict (simulation complete) and concurrent injection errors
    - _Requirements: 12.3, 5.4, 5.5_

- [x] 14. Frontend: Simulation View page (complete state)
  - [x] 14.1 Implement D3.js H/D spectrum visualization
    - Create horizontal strip with positioned dealer markers (circles with monogram text)
    - Color markers on hawkish (red) to dovish (blue) gradient
    - Implement Framer Motion slide-to-position animation from center (600ms, easeOutBack)
    - Support both light and dark theme colors
    - _Requirements: 9.1, 13.4_

  - [x] 14.2 Implement D3.js position evolution chart
    - Create multi-line chart showing each dealer's H/D score trajectory across all rounds
    - Color-code lines per dealer with legend
    - Highlight influence relationships (which dealers moved which others)
    - Support zoom and hover tooltips showing exact values
    - _Requirements: 9.2, 17.4_

  - [x] 14.3 Implement comparative results table
    - Create shadcn Table with expandable rows showing each dealer's final position
    - Display: rate path, balance sheet, risk assets, H/D score, confidence
    - Implement row expansion with Framer Motion (250ms, easeOutQuad) showing reasoning markdown, position shift indicators (TrendingUp/TrendingDown icons), and influence badges
    - Add sort controls (ArrowUpDown icon)
    - _Requirements: 9.3, 9.4, 13.5_

  - [x] 14.4 Implement discussion transcript display
    - Create collapsible markdown sections per round
    - Show round-by-round narrative: who said what, who shifted, and why
    - Highlight anchor dealer and swing dealer labels
    - Display cluster analysis summary
    - _Requirements: 9.5, 18.1, 18.2, 18.3, 18.4_

  - [x] 14.5 Implement source citations display (in expanded simulation view)
    - Show source list with ExternalLink icons and domain badges
    - Display title, snippet, published date, and relevance score
    - _Requirements: 9.6_

- [x] 15. Frontend: Knowledge Graph page
  - [x] 15.1 Implement D3.js force-directed graph visualization
    - Create full-screen SVG canvas with D3 force simulation
    - Render four node types: Dealer (circle with monogram), Topic (rounded rectangle), Concern (diamond/hexagon), Crisis (triangle)
    - Render five edge types with appropriate styling: Influence (directed arrow, weighted), Concern (dashed), Topic (solid), Correlation (dotted), Crisis (thick amber)
    - Implement collision detection to prevent node overlap
    - _Requirements: 10.1, 10.2_

  - [x] 15.2 Implement graph interactions and side panel
    - Implement click handlers for dealer, topic, and concern nodes
    - Create shadcn Sheet side panel showing node-specific details (position history, top concerns, simulation summary, dealer positions)
    - Implement zoom, pan, and drag-to-rearrange with D3 zoom behavior
    - Implement semantic zoom (clusters at zoom-out, full labels at zoom-in)
    - Add zoom controls (ZoomIn/ZoomOut/RotateCcw icons) and legend
    - _Requirements: 10.3, 10.4, 10.5_

  - [x] 15.3 Implement graph animations with Framer Motion
    - Node entrance: scale from 0 + fade in (500ms, 30ms stagger, easeOutBack)
    - Edge draw: stroke-dashoffset animation (800ms, easeInOutQuad)
    - _Requirements: 13.5_

- [x] 16. Frontend: History page
  - [x] 16.1 Implement simulation history list
    - Create searchable, filterable list of all past simulations
    - Display simulation summaries: event title, status icons, number of rounds, creation date, final consensus indicators
    - Create mini H/D sparklines using D3 inline SVG
    - Implement pagination with ChevronLeft/ChevronRight icons
    - Implement search input with Search icon and filter dropdowns with ChevronDown icons
    - Sort by creation time (most recent first)
    - _Requirements: 16.1, 16.2, 16.3, 14.4_

  - [ ]* 16.2 Write property test for user-scoped queries
    - **Property 23: User-Scoped Query Isolation** â€” Querying simulations for a user returns only that user's simulations, sorted descending by creation time
    - **Validates: Requirement 16.1**

  - [ ]* 16.3 Write property test for unauthenticated response uniformity
    - **Property 27: Unauthenticated Response Uniformity** â€” Protected endpoints return identical 401 for any resource ID without revealing existence
    - **Validates: Requirement 19.4**

- [x] 17. Checkpoint â€” Frontend pages complete
  - All 11 routes return 200 OK. Light + dark mode verified. D3 visualizations render with sample data. Lucide icons used exclusively (zero emojis). Framer Motion animations fire on page load and interactions.

- [x] 18. Integration wiring and error handling
  - [x] 18.1 Implement GET /simulations/{id} Lambda for status and results
    - Create handler that reads simulation record + all rounds + reactions from DynamoDB
    - Merge into SimulationView response (simulation metadata + event + rounds with reactions + transcript URL)
    - Return current progress (currentRound/totalRounds) for running simulations
    - _Requirements: 12.1, 16.3_

  - [x] 18.2 Implement GET /graph endpoints for knowledge graph data
    - Create handler for GET /graph/subgraph returning nodes + edges (filterable by time range, node type)
    - Create handler for GET /graph/nodes/{id} returning single node + connected edges
    - Serve cached graph JSON from S3 for fast initial load
    - _Requirements: 10.3, 10.4, 10.5_

  - [x] 18.3 Implement frontend build and deploy pipeline
    - Created `frontend/scripts/deploy.sh` (build + S3 sync + CloudFront invalidation) and `backend/scripts/deploy-lambdas.sh` (esbuild bundle + lambda update-function-code per function)
    - Documented full deploy process in README.md (Prerequisites, Local Dev, Deployment, API Endpoints, Env Vars, Disclaimer sections)
    - `NEXT_PUBLIC_API_URL` propagated through deploy.sh
    - _Requirements: 15.1_

  - [x] 18.4 Configure Secrets Manager for sensitive values
    - Created `terraform/modules/secrets/` with auto-generated JWT secret (random_password 64 chars) and Tavily API key placeholder
    - Wired `module.secrets.jwt_secret_arn` and `module.secrets.tavily_api_key_arn` into lambda module
    - Tavily key uses `ignore_changes = [secret_string]` so it can be set via console post-deploy
    - _Requirements: 15.5, 19.5_

  - [x] 18.5 Wire frontend API client to deployed API Gateway endpoints
    - `frontend/src/lib/api-client.ts` reads `NEXT_PUBLIC_API_URL` env var as base URL
    - Token management: localStorage `ms-token`, attached as `Authorization: Bearer` on all requests
    - 401 responses trigger token clear + redirect to `/auth/login`
    - `ApiError` class for typed error responses; new sounding launch button surfaces `ApiError.status: message` in UI
    - Falls back to `/console/sounding/demo` route when `NEXT_PUBLIC_API_URL` is not set (dev mode)
    - _Requirements: 20.3, 20.4_

  - [x] 18.6 Implement simulation status polling and real-time updates
    - `SimulationViewClient` polls `api.simulations.get(id)` every 2 seconds while status === 'running' for non-demo IDs
    - Falls back to 5s retry on transient errors (network/timeout)
    - Mirrors live `currentRound` and completed-reaction count to existing RunningView UI
    - On status === 'complete', renders new `CompleteView` from live `SimulationView` data (HD spectrum + position evolution + dealer table + transcript)
    - Demo IDs (`demo`, `running`) still use the simulated polling for offline/demo use
    - _Requirements: 12.4_

  - [x] 18.7 Implement error handling across the stack
    - Bedrock timeouts already handled via `createFailedReaction()` in dealer-agent index.ts (try/catch returns `status: 'failed'`)
    - Step Functions failures handled by `kickoff.ts` setting simulation `status: 'failed'` with `error` field on StartExecution failure
    - Malformed LLM responses handled by `parseReactionResponse` retry-once logic in reaction-parser
    - DynamoDB throttling handled by AWS SDK default exponential backoff
    - Frontend shows "Simulation failed" badge in CompleteView when `sim.status === 'failed'`
    - Polling errors don't crash the UI — error message displayed inline with retry continuing in background
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5_

  - [x] 18.8 Implement sample events data
    - Create 3 pre-configured sample events for the dashboard and New Sounding page
    - Include realistic market scenarios (e.g., FOMC decision, tariff announcement, oil supply shock)
    - Store as static data accessible without authentication
    - _Requirements: 2.3, 14.3_

- [ ] 19. Final checkpoint â€” Full integration verification
  - Ensure all tests pass (unit + property), Terraform plan is clean, frontend builds without errors, and all API routes return expected responses. Verify light/dark mode, animations, D3 charts, and knowledge graph render correctly. Ask the user if questions arise.

- [x] 20. Frontend Redesign (post-MVP refinement)
  - [x] 20.1 Replaced sidebar navigation with header-based navigation (more professional, MiroFish-inspired)
  - [x] 20.2 Built marketing landing page at `/` with hero, features grid, workflow steps, dealer panel, CTA
  - [x] 20.3 Built About page at `/about` with mission, tech stack grid, disclaimer block
  - [x] 20.4 Built Agent Chat at `/chat` with dealer picker sidebar, chat bubbles, suggested prompts (mock responses; backend wiring pending)
  - [x] 20.5 Restructured routes: console pages moved to `/console/*` (dashboard, sounding, graph, history)
  - [x] 20.6 Created `MarketingShell` (landing/about/auth) and `ConsoleShell` (app pages) layouts
  - [x] 20.7 Applied investment platform aesthetic: editorial typography, monospace data displays, status indicators with pulsing dots, terminal-style step counters
  - _Inspired by:_ MiroFish demo console (https://mirofish-demo.pages.dev/console)

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout â€” all implementation uses TypeScript/Node.js for backend and TypeScript/React for frontend
- Terraform modules should be developed and validated before Lambda code to ensure infrastructure is ready
- Frontend can be developed in parallel with backend after the API interface is defined

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1"]
    },
    {
      "wave": 2,
      "tasks": ["2"]
    },
    {
      "wave": 3,
      "tasks": ["3", "4", "5"]
    },
    {
      "wave": 4,
      "tasks": ["6"]
    },
    {
      "wave": 5,
      "tasks": ["7"]
    },
    {
      "wave": 6,
      "tasks": ["8"]
    },
    {
      "wave": 7,
      "tasks": ["9"]
    },
    {
      "wave": 8,
      "tasks": ["10", "11", "12", "13", "14", "15", "16"]
    },
    {
      "wave": 9,
      "tasks": ["17"]
    },
    {
      "wave": 10,
      "tasks": ["18"]
    },
    {
      "wave": 11,
      "tasks": ["19"]
    }
  ]
}
```
