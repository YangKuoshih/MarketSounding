# Requirements Document

## Introduction

MarketSounding is a multi-agent market reaction simulator that models how primary dealers respond to market events through a MiroFish-style multi-round "roundtable" interaction. Users provide a topic, the system searches the web for relevant news, synthesizes an event brief, and feeds it into a multi-round dealer simulation where 5 AI-driven dealer personas react, see each other's views, and iteratively update their positions across 3-5 rounds. The system includes crisis injection, convergence detection, position evolution tracking, knowledge graph visualization, and full discussion transcript generation.

The system is deployed as a fully serverless AWS stack (Lambda + Step Functions + API Gateway + DynamoDB + S3 + CloudFront + Bedrock + AgentCore) managed via Terraform, with a Next.js 15 frontend statically exported to S3 and served via CloudFront.

## Glossary

- **Simulation_Engine**: The Step Functions state machine that orchestrates multi-round dealer interactions, manages round progression, handles crisis injection, and coordinates parallel agent invocations.
- **Dealer_Agent**: An AgentCore-managed agent representing a single primary dealer persona, maintaining session memory across rounds and generating reactions grounded in persona profile and peer context.
- **Auth_Service**: The Lambda-based authentication service using DynamoDB as user store with JWT token management.
- **Research_Agent**: The Lambda function that accepts a user-provided topic, searches the web via Tavily API, and synthesizes findings into a structured event brief.
- **Frontend**: The Next.js 15 application statically exported to S3 and served via CloudFront, providing the user interface.
- **Knowledge_Graph_Builder**: The post-processing Lambda that extracts graph data (nodes and edges) from completed simulations.
- **Graph_Visualizer**: The D3.js force-directed graph component rendering dealers, topics, concerns, and their relationships.
- **Convergence_Detector**: The algorithm that calculates average absolute position shift across dealers to determine if positions have stabilized.
- **Transcript_Generator**: The component that produces markdown-formatted round-by-round narrative of the simulation.
- **H/D_Score**: The hawkish/dovish score on a [-1, +1] scale representing a dealer's monetary policy stance.
- **Round**: A single iteration of the multi-round simulation where all dealers produce reactions.
- **Crisis_Event**: A user-injected market disruption that forces all dealers to re-evaluate their positions.
- **Persona**: A predefined dealer profile (GS, JPM, MS, Citi, BofA) with characteristic biases and analytical frameworks.
- **Event_Brief**: A structured synthesis of web search results about a market topic, formatted for dealer analysis.

## Requirements

### Requirement 1: Topic-Based Event Research

**User Story:** As a user, I want to type a market topic and have the system search the web for the latest relevant news and synthesize it into a coherent event brief, so that I can run simulations on current market developments without manually gathering information.

#### Acceptance Criteria

1. WHEN a user submits a topic string, THE Research_Agent SHALL generate 2-3 search query variants using Haiku and execute web searches via Tavily API
2. WHEN search results are returned, THE Research_Agent SHALL filter results by recency and relevance, then synthesize the top 3-5 sources into a structured Event_Brief using Opus 4.7
3. THE Research_Agent SHALL return source citations (title, URL, snippet, published date, domain, relevance score) alongside the synthesized event for transparency
4. WHEN a topic has been recently searched, THE Research_Agent SHALL return cached results from DynamoDB to avoid redundant API calls
5. IF the Tavily API returns zero results or fails, THEN THE Research_Agent SHALL return a descriptive error indicating the search failed and suggest the user try a different topic or paste text directly

### Requirement 2: Event Input Modes

**User Story:** As a user, I want multiple ways to provide market events (topic search, paste raw text, select from samples), so that I can use the system flexibly regardless of whether I have a specific topic or prepared text.

#### Acceptance Criteria

1. THE Frontend SHALL provide three input modes: Search (topic-based web research), Paste (raw text input), and Sample (pre-configured example events)
2. WHEN a user selects the Paste input mode, THE Frontend SHALL accept raw text up to 50KB and create an event record directly without web search
3. WHEN a user selects a sample event, THE Frontend SHALL load the pre-configured event data and allow the user to proceed to simulation configuration
4. THE Frontend SHALL display the synthesized event brief with source citations before the user confirms and launches a simulation

### Requirement 3: Multi-Round Simulation Orchestration

**User Story:** As a user, I want the simulation to run multiple rounds where dealers see each other's reactions and iteratively update their views, so that I can observe how dealer opinions evolve through peer influence.

#### Acceptance Criteria

1. WHEN a simulation is started, THE Simulation_Engine SHALL execute Round 1 with all dealers reacting independently (no peer context) using parallel Map state invocations
2. WHEN Round 1 completes, THE Simulation_Engine SHALL execute subsequent rounds sequentially, providing each dealer with all other dealers' prior round reactions
3. THE Simulation_Engine SHALL ensure each dealer sees all OTHER dealers' prior reactions but never their own prior reaction in the peer context
4. WHEN all rounds complete or convergence is detected, THE Simulation_Engine SHALL update the simulation status to "complete" and persist all results
5. IF a dealer agent invocation fails (timeout or error), THEN THE Simulation_Engine SHALL mark that dealer's reaction as failed and continue the simulation with remaining dealers
6. THE Simulation_Engine SHALL write round results to DynamoDB after each round completes, before proceeding to the next round

### Requirement 4: Convergence Detection

**User Story:** As a user, I want the simulation to automatically stop when dealer positions have stabilized, so that unnecessary rounds are not executed when consensus has been reached.

#### Acceptance Criteria

1. WHEN a round completes, THE Convergence_Detector SHALL calculate the average absolute position shift (H/D score delta) across all dealers compared to the prior round
2. WHEN the convergence score falls below the configured threshold (default 0.1), THE Simulation_Engine SHALL terminate the simulation early
3. IF no valid comparison pairs exist (all dealers failed), THEN THE Convergence_Detector SHALL return 1.0 (maximum divergence) to force continuation
4. THE Convergence_Detector SHALL exclude failed dealers from the convergence calculation

### Requirement 5: Crisis Injection

**User Story:** As a user, I want to inject a crisis event mid-simulation that forces all dealers to re-evaluate their positions, so that I can observe how sudden market disruptions shift dealer views.

#### Acceptance Criteria

1. WHEN crisis injection is enabled, THE Simulation_Engine SHALL pause between rounds using the Task Token pattern and wait for crisis input (default timeout: 120 seconds)
2. WHEN a user submits a crisis event during the wait window, THE Simulation_Engine SHALL execute a crisis re-evaluation round where all dealers receive the original event, crisis text, and all prior positions
3. IF the crisis wait timeout expires without input, THEN THE Simulation_Engine SHALL proceed with a normal peer response round
4. IF a user attempts to inject a crisis into a completed simulation, THEN THE Frontend SHALL return a 409 Conflict response with message "Simulation already complete"
5. IF multiple crisis injections are attempted simultaneously, THEN THE Simulation_Engine SHALL accept only the first (Task Token pattern) and reject subsequent attempts with "Crisis already injected for this round"

### Requirement 6: Dealer Agent Persona Simulation

**User Story:** As a user, I want each dealer to respond authentically according to their established house view and analytical framework, so that the simulation produces realistic and differentiated reactions.

#### Acceptance Criteria

1. THE Dealer_Agent SHALL load the persona profile and session memory from AgentCore Memory before generating each reaction
2. WHEN generating a reaction, THE Dealer_Agent SHALL invoke Bedrock Claude Opus 4.7 with a structured prompt containing persona profile, event context, and round-appropriate peer context
3. THE Dealer_Agent SHALL produce a structured reaction containing: rate path view, balance sheet view, risk asset view, key concerns (1-3 items), H/D score (-1 to +1), confidence (0 to 1), and reasoning markdown (2-3 paragraphs in persona voice)
4. WHEN in a peer response round, THE Dealer_Agent SHALL reference specific peers by name when explaining position shifts and identify which dealers influenced the update
5. THE Dealer_Agent SHALL store updated state in AgentCore Memory after each round, maintaining position history and influence tracking across the simulation session

### Requirement 7: Reaction Data Validation

**User Story:** As a developer, I want all dealer reactions to be validated and bounded before storage, so that the system maintains data integrity regardless of LLM output variability.

#### Acceptance Criteria

1. THE Dealer_Agent SHALL clamp the hawkishDovishScore to the range [-1, +1] regardless of LLM output
2. THE Dealer_Agent SHALL clamp the confidence value to the range [0, 1] regardless of LLM output
3. THE Dealer_Agent SHALL validate that keyConcerns contains 1-3 items and reasoningMd is non-empty
4. WHEN the positionShift is reported, THE Dealer_Agent SHALL verify it equals the arithmetic difference between the current and prior round H/D scores (within 0.001 tolerance)
5. IF the LLM response is malformed JSON or missing required fields, THEN THE Dealer_Agent SHALL attempt one retry with a more explicit prompt before marking the reaction as failed

### Requirement 8: Authentication

**User Story:** As a user, I want to register and log in with a username and password, so that my simulations are associated with my account and I can access my history.

#### Acceptance Criteria

1. WHEN a user registers, THE Auth_Service SHALL hash the password with bcrypt (10 rounds) and store the user record in DynamoDB
2. WHEN a user logs in with valid credentials, THE Auth_Service SHALL issue a JWT token with 24-hour expiry signed with HS256
3. WHEN a user provides invalid credentials, THE Auth_Service SHALL return an identical error message ("Invalid credentials") regardless of whether the username exists or the password is wrong
4. THE Auth_Service SHALL perform timing-safe credential validation by hashing even when the user is not found, preventing timing-based user enumeration
5. WHEN a JWT token has expired, THE Auth_Service SHALL return 401 Unauthorized and the Frontend SHALL redirect to the login page
6. THE Auth_Service SHALL validate that usernames are 3-50 characters, alphanumeric plus underscore, and passwords are at least 8 characters

### Requirement 9: Simulation Results Visualization

**User Story:** As a user, I want to view simulation results with a hawkish/dovish spectrum, position evolution chart, comparative table, and discussion transcript, so that I can understand how dealer views evolved across rounds.

#### Acceptance Criteria

1. THE Frontend SHALL display a D3.js horizontal H/D spectrum strip with positioned dealer markers showing final positions
2. THE Frontend SHALL display a D3.js multi-line chart showing each dealer's H/D score trajectory across all rounds
3. THE Frontend SHALL display a comparative table with expandable rows showing each dealer's final position (rate path, balance sheet, risk assets, H/D score, confidence)
4. WHEN a table row is expanded, THE Frontend SHALL show the dealer's reasoning markdown, position shift indicators (with Lucide TrendingUp/TrendingDown icons), and influence badges
5. THE Frontend SHALL generate and display a markdown-formatted discussion transcript showing round-by-round narrative of who said what, who shifted, and why
6. WHEN sources were used in event research, THE Frontend SHALL display source citations with ExternalLink icons and domain badges

### Requirement 10: Knowledge Graph Visualization

**User Story:** As a user, I want an interactive knowledge graph showing relationships between dealers, topics, and concerns across all simulations, so that I can identify patterns in dealer behavior and topic correlations.

#### Acceptance Criteria

1. THE Graph_Visualizer SHALL render a D3.js force-directed graph with four node types: Dealer (circle with monogram), Topic (rounded rectangle), Concern (diamond/hexagon), and Crisis (triangle)
2. THE Graph_Visualizer SHALL render five edge types: Influence (dealer-to-dealer, directed arrow weighted by shift magnitude), Concern (dealer-to-concern, dashed), Topic (topic-to-dealer, solid), Correlation (topic-to-topic, dotted), and Crisis (crisis-to-topic, thick amber)
3. WHEN a user clicks a dealer node, THE Graph_Visualizer SHALL display a side panel showing position history, top concerns, influence relationships, and consistency score
4. WHEN a user clicks a topic node, THE Graph_Visualizer SHALL display a side panel showing simulation summary, all dealer final positions, and a link to full results
5. THE Graph_Visualizer SHALL support zoom, pan, and drag-to-rearrange interactions with semantic zoom (clusters at zoom-out, full labels at zoom-in)
6. THE Knowledge_Graph_Builder SHALL extract graph data from each completed simulation including influence edges, concern nodes, topic correlations (Jaccard similarity > 0.3), and dealer aggregate updates

### Requirement 11: Knowledge Graph Data Persistence

**User Story:** As a developer, I want graph data stored efficiently so that the knowledge graph loads quickly and scales with simulation count.

#### Acceptance Criteria

1. THE Knowledge_Graph_Builder SHALL store graph nodes in a DynamoDB table with nodeId as partition key, containing nodeType, label, and type-specific metadata
2. THE Knowledge_Graph_Builder SHALL store graph edges in a DynamoDB table with sourceNodeId as partition key and composite sort key (targetNodeId#edgeType#timestamp)
3. WHEN more than 50 simulations exist, THE Knowledge_Graph_Builder SHALL aggregate parallel influence edges between the same dealer pair into a single weighted edge
4. THE Knowledge_Graph_Builder SHALL cache the full graph JSON in S3 for fast frontend retrieval, rebuilding on each new simulation completion

### Requirement 12: Simulation Progress Tracking

**User Story:** As a user, I want to see real-time progress of my running simulation, so that I know which round is executing and which dealers have completed.

#### Acceptance Criteria

1. WHILE a simulation is running, THE Frontend SHALL display a progress bar with round counter (current round / total rounds)
2. WHILE a simulation is running, THE Frontend SHALL display dealer avatar indicators showing completion status per dealer (CheckCircle for complete, Loader for running)
3. WHILE a simulation is running and crisis injection is enabled, THE Frontend SHALL display a crisis injection textarea with a submit button (Zap icon)
4. THE Frontend SHALL poll the simulation status endpoint every 2 seconds until the simulation completes or fails

### Requirement 13: UI Theme and Design Standards

**User Story:** As a user, I want a professional fintech interface with both light and dark mode support, so that I can use the application comfortably in any lighting environment.

#### Acceptance Criteria

1. THE Frontend SHALL support both light and dark themes with system preference detection and a manual toggle (Sun/Moon Lucide icons)
2. THE Frontend SHALL use Fira Code for monospace/data display and Fira Sans for UI text exclusively (no other fonts)
3. THE Frontend SHALL use Lucide React icons exclusively with zero emojis anywhere in the interface
4. THE Frontend SHALL use D3.js for all data visualizations (no Tremor, Recharts, or Chart.js)
5. THE Frontend SHALL use Anime.js for UI micro-interactions including staggered card reveals (300ms, 50ms stagger), dealer completion pulses (400ms), table row expansion (250ms), and graph node entrance animations (500ms, 30ms stagger)
6. THE Frontend SHALL maintain WCAG-compliant color contrast (4.5:1 for normal text, 3:1 for large text) in both themes
7. THE Frontend SHALL display a persistent, non-dismissible disclaimer banner on all pages showing simulated content: "Simulated views -- not actual dealer commentary"

### Requirement 14: Application Navigation and Pages

**User Story:** As a user, I want clear navigation between the dashboard, new sounding creation, simulation results, knowledge graph, and history pages, so that I can efficiently access all features.

#### Acceptance Criteria

1. THE Frontend SHALL provide a collapsible sidebar navigation with Lucide icons and text labels for: Home/Dashboard (/), New Sounding (/sounding/new), Knowledge Graph (/graph), and History (/history)
2. THE Frontend SHALL provide a top bar with app logo/name (left) and theme toggle plus user avatar dropdown (right)
3. WHEN a user visits the Home/Dashboard page, THE Frontend SHALL display a hero search input, sample event cards (3), and a recent soundings table with status badges
4. WHEN a user visits the History page, THE Frontend SHALL display a searchable, filterable list of all past simulations with status icons and mini H/D sparklines

### Requirement 15: Infrastructure as Code

**User Story:** As a developer, I want all AWS resources managed via Terraform with modular structure, so that infrastructure can be deployed and updated reliably across environments.

#### Acceptance Criteria

1. THE Infrastructure SHALL be defined in Terraform with modular structure: dynamodb, s3, cloudfront, api-gateway, lambda, step-functions, bedrock, and iam modules
2. THE Infrastructure SHALL provision DynamoDB tables (users, events, simulations, rounds, reactions, graph_nodes, graph_edges) with appropriate partition keys, sort keys, and GSIs as specified in the data model
3. THE Infrastructure SHALL configure API Gateway with rate limiting (100 req/s per IP) and CORS set to allow all origins (`Access-Control-Allow-Origin: *`)
4. THE Infrastructure SHALL support separate environment configurations (dev, prod) via tfvars files
5. THE Infrastructure SHALL configure all data at rest with encryption (DynamoDB encryption, S3 SSE-S3) and all data in transit with TLS 1.2+

### Requirement 16: Simulation History and Ownership

**User Story:** As a user, I want to view my past simulations and their results, so that I can review previous analyses and compare outcomes across different events.

#### Acceptance Criteria

1. WHEN a user requests their simulation history, THE Frontend SHALL query simulations filtered by userId and sorted by creation time (most recent first)
2. THE Frontend SHALL display simulation summaries including event title, status, number of rounds, creation date, and final consensus indicators
3. WHEN a user clicks a past simulation, THE Frontend SHALL navigate to the full simulation view with all rounds, reactions, and transcript

### Requirement 17: Position Evolution Tracking

**User Story:** As a user, I want to see how each dealer's position evolved across rounds including who influenced whom, so that I can understand the dynamics of opinion formation.

#### Acceptance Criteria

1. THE Dealer_Agent SHALL track and report positionShift (delta from prior round H/D score) for all rounds after Round 1
2. THE Dealer_Agent SHALL report influencedBy (list of persona IDs) indicating which peers caused a position update
3. THE Dealer_Agent SHALL report a keyQuote (one sentence) explaining the shift reasoning or reason for holding firm
4. THE Frontend SHALL visualize influence relationships in the position evolution chart, highlighting which dealers moved which others

### Requirement 18: Discussion Transcript Generation

**User Story:** As a user, I want a formatted discussion transcript showing the full roundtable conversation, so that I can read through the simulation as a narrative document.

#### Acceptance Criteria

1. WHEN a simulation completes, THE Transcript_Generator SHALL produce a markdown-formatted document organized by round
2. THE Transcript_Generator SHALL include each dealer's reasoning, position shifts, influence attributions, and key quotes per round
3. THE Transcript_Generator SHALL identify and label the "anchor" dealer (least total movement) and "swing" dealer (most total movement) in the transcript summary
4. THE Transcript_Generator SHALL include cluster analysis showing which dealers ended up aligned and which remained outliers

### Requirement 19: API Security and Input Validation

**User Story:** As a developer, I want all API endpoints secured and inputs validated, so that the system is protected against abuse and malformed data.

#### Acceptance Criteria

1. THE Auth_Service SHALL require a valid JWT Bearer token on all protected API routes (simulations, events, graph endpoints)
2. THE Frontend SHALL validate that event text input does not exceed 50KB before submission
3. THE Auth_Service SHALL validate username format (3-50 chars, alphanumeric + underscore) and password minimum length (8 chars) on registration
4. WHEN an unauthenticated request reaches a protected endpoint, THE Auth_Service SHALL return 401 Unauthorized without revealing whether the resource exists
5. THE Infrastructure SHALL enforce HTTPS for all API traffic via API Gateway TLS 1.2+ configuration

### Requirement 20: Error Handling and Resilience

**User Story:** As a user, I want the system to handle failures gracefully without losing my data, so that I can retry or continue after errors.

#### Acceptance Criteria

1. IF a Bedrock model invocation exceeds 60 seconds, THEN THE Dealer_Agent SHALL mark that reaction as failed and the simulation SHALL continue with remaining dealers
2. IF the Step Functions state machine encounters an unrecoverable error, THEN THE Simulation_Engine SHALL write simulation status as "failed" with error details to DynamoDB
3. WHEN a simulation fails, THE Frontend SHALL display "Simulation failed" with an option to retry using the preserved event data
4. IF DynamoDB write throttling occurs, THEN THE Simulation_Engine SHALL retry with exponential backoff (AWS SDK built-in)
5. WHEN a malformed LLM response is received, THE Dealer_Agent SHALL attempt one retry with a more explicit prompt before marking as failed
