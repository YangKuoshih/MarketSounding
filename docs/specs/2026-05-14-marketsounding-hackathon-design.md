---
name: MarketSounding — Hackathon Edition Design
description: 48-hour hackathon build spec for MarketSounding, a multi-persona market reaction simulator inspired by MiroFish
status: approved-pending-review
date: 2026-05-14
author: Tony Yang (kuoshihtyang@gmail.com)
---

# MarketSounding — Hackathon Edition Design

## 1. Project framing

**Name:** MarketSounding

**One-line pitch:** A decision-support tool for NY Fed Markets desk staff that simulates how primary dealers would react to a market event, producing a comparative brief in seconds.

**Tagline (for landing page):** *A market-soundings sandbox for the Markets desk.*

**Inspiration:** Architecturally inspired by the [MiroFish](https://github.com/yangkuoshih/MiroFish) multi-agent simulation engine. MiroFish uses agent personas + knowledge graphs + simulation to predict societal/narrative outcomes from seed materials. MarketSounding adapts the same conceptual pattern to a tightly bounded financial use case: simulating dealer reactions to market events for a Federal Reserve Markets-Group audience.

**Hackathon constraints driving every decision in this spec:**
- 48 hours total build time
- Solo developer + Claude Code
- AWS infrastructure for hosting (Amplify), but free choice of LLM provider (Anthropic API direct, not Bedrock — to skip Bedrock setup time)
- Goal: a polished demo, not a production-ready Fed tool

The longer-term production design (Bedrock + KB + DynamoDB + Cognito + persona seeding pipeline + multi-phase persona expansion) is captured separately in `production-roadmap.md`. This document is scoped strictly to what gets built in 48 hours.

---

## 2. Target user (for the pitch)

**Primary audience:** NY Federal Reserve Bank Markets Group desk staff and economists who run/analyze the Survey of Primary Dealers (SPD) and Survey of Market Participants (SMD/SME).

**Honest framing for any user-facing copy:** The tool produces *simulated* views grounded in public material. It is a thinking sandbox, not a data source — never a replacement for actual dealer commentary or survey responses.

---

## 3. MVP scope (what gets built in 48 hours)

### 3.1 Workflow supported

**Live event reaction simulation only.** User submits a market event (FOMC statement, CPI release, breaking news headline) → app fans out to N simulated dealer personas → returns a comparative reaction brief.

Out of scope (explicitly): pre-survey anticipation, scenario branching, survey response augmentation, multi-turn roundtable transcript. These are future phases described in the production roadmap.

### 3.2 Persona universe

**5 primary dealer personas:**
- Goldman Sachs (GS)
- JP Morgan (JPM)
- Morgan Stanley (MS)
- Citi
- Bank of America (BofA)

Personas are stored as a typed array in `personas/index.ts`. Each persona has:
- `id`, `name`, `short_name`, `type: "primary_dealer"`
- `profile_md`: ~1-page hand-authored brief with house view, key voices, recent positioning, biases, hawkish/dovish lean, typical concerns
- `hawkish_dovish_bias`: prior on -1 to +1 scale
- `avatar_text`: 2-letter monogram for UI (no logo files needed)

**Profile authoring:** Author each profile in ~30 minutes with Claude's help, drawing from public knowledge of each firm's research positioning. Total: ~2.5 hours of content work.

### 3.3 Pages (3 total)

| Path | Purpose |
|---|---|
| `/` | Landing + new simulation form. Hero, paste-event textarea, 3 sample event cards, recent simulations list. |
| `/sim/[id]` | Single page handling both `running` (loading screen with persona avatars filling in) and `complete` (results table + hawkish/dovish strip) states. |
| `/about` | Brief project page + roadmap diagram for judges. |

No PDF upload, no auth, no persona library page, no separate Cards/Dashboard tabs.

### 3.4 Results view

**One screen, table-centric:**
- Tremor `Tracker` strip across the top: hawkish/dovish positions of all personas, color-coded
- shadcn `Table` below: rows = personas, columns = `Persona`, `Rate path`, `Balance sheet`, `Risk assets`, `H/D score`, `Confidence`, `Top concern`
- Click a row → expand inline to show that persona's `reasoning_md` (2-3 paragraphs in-voice) plus a `simulated` chip
- Click hawkish/dovish strip → reorders table by score
- Persistent banner at top: *"Simulated views — not actual dealer commentary."*

### 3.5 Sample events (baked in)

Three events stored as JSON files in `data/sample-events/`, displayed as clickable cards on the landing page:
1. FOMC statement (a real recent statement, public text)
2. CPI release (real, public BLS text)
3. Geopolitical headline (one curated public headline)

Sample events are critical: judges will not paste anything during the pitch. Clicking a sample card → instantly creates a simulation and routes to `/sim/[id]`.

---

## 4. Architecture & stack

### 4.1 Stack

| Layer | Choice |
|---|---|
| App | Next.js 15 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Components | shadcn/ui |
| Charts | Tremor |
| LLM | Anthropic SDK (Claude Sonnet 4.5) — direct API, **not** Bedrock |
| Persona storage | TypeScript file `personas/index.ts` (no DB) |
| Sim/event storage | JSON files in `/data/` directory + in-memory cache (no DB) |
| Hosting | AWS Amplify (auto-deploy from GitHub) |
| Auth | None |
| Observability | Console logs + Amplify build logs |

### 4.2 Why these choices

- **Next.js full-stack** — single language, single deploy, fastest scaffold
- **Anthropic direct (not Bedrock)** — Bedrock model access provisioning + IAM + Converse API setup costs 4-6 hours; Anthropic SDK is 1 line. Migrate post-hackathon.
- **AWS Amplify** — meets the "AWS infrastructure" constraint while staying as simple as Vercel for a Next.js app
- **JSON files for persistence** — for 48 hours of demo data, DynamoDB is overkill. Migrate post-hackathon.
- **shadcn + Tremor** — shadcn for the table/buttons/cards, Tremor for the one chart that matters

### 4.3 High-level architecture

```
┌─────────────────────────────────────────────────────────┐
│  Next.js App (TypeScript)                               │
│  ┌──────────────┐    ┌─────────────────────────────┐    │
│  │  React UI    │ ⇄  │  API routes                 │    │
│  │  shadcn +    │    │  - POST /api/sim/run        │    │
│  │  Tremor      │    │  - GET  /api/sim/[id]       │    │
│  │              │    │  - GET  /api/personas       │    │
│  │              │    │  - GET  /api/events/samples │    │
│  └──────────────┘    └────────────┬────────────────┘    │
└────────────────────────────────────┼────────────────────┘
                                     │
            ┌────────────────────────┼────────────────────┐
            │ lib/                   │                    │
            │  ┌─────────────────┐   │                    │
            │  │ SimulationRunner│ ──┴── orchestrates     │
            │  └────────┬────────┘                        │
            │           │                                 │
            │  ┌────────┴───────┐  ┌───────────────────┐  │
            │  │  PersonaAgent  │  │  Storage          │  │
            │  │  (Claude API)  │  │  (JSON files)     │  │
            │  └────────────────┘  └───────────────────┘  │
            └─────────────────────────────────────────────┘
                       │                       │
              ┌────────┴────────┐    ┌─────────┴────────┐
              │  Anthropic API  │    │  /data/*.json    │
              └─────────────────┘    └──────────────────┘
```

**Concurrency:** N personas fire in parallel via `p-limit(5)` to stay under the Anthropic rate limit. ~25-30s wall-clock for 5 personas.

---

## 5. Data model

### 5.1 Persona (TypeScript, in `personas/index.ts`)

```ts
export type Persona = {
  id: string;                       // 'gs', 'jpm', ...
  name: string;                     // 'Goldman Sachs'
  short_name: string;               // 'GS'
  type: 'primary_dealer';           // (Phase 2: 'buy_side' | 'fomc')
  profile_md: string;               // ~1 page house-view brief
  hawkish_dovish_bias: number;      // -1..+1 prior
  avatar_text: string;              // 'GS' (2 chars)
  active: boolean;
};
```

### 5.2 Event (JSON file in `data/events/<id>.json`)

```ts
export type Event = {
  id: string;                       // uuid or slug
  title: string;
  source: 'pasted' | 'sample';
  raw_text: string;
  summary: string | null;           // LLM-generated, may be null on submit
  event_date: string;               // ISO date
  created_at: string;               // ISO timestamp
};
```

### 5.3 Simulation (JSON file in `data/sims/<id>.json`)

```ts
export type Simulation = {
  id: string;
  event_id: string;
  status: 'queued' | 'running' | 'complete' | 'failed';
  persona_ids: string[];
  reactions: Reaction[];            // populated as personas complete
  created_at: string;
  completed_at: string | null;
  error: string | null;
};
```

### 5.4 Reaction (embedded in Simulation)

```ts
export type Reaction = {
  persona_id: string;
  status: 'pending' | 'complete' | 'failed';
  rate_path_view: string;           // 1 sentence
  balance_sheet_view: string;       // 1 sentence
  risk_asset_view: string;          // 1 sentence
  key_concerns: string[];           // 1-3 strings
  hawkish_dovish_score: number;     // -1..+1
  confidence: number;               // 0..1
  surprise_score: number;           // 0..1
  reasoning_md: string;             // 2-3 paragraphs in persona voice
  error: string | null;
};
```

---

## 6. Simulation flow

```
1. INGEST     POST /api/sim/run with { event_id?, raw_text?, title? }
              ├─ If raw_text provided, create event record
              ├─ Generate 2-line summary via cheap Claude call
              └─ Create simulation record (status='queued')

2. PLAN       Resolve persona list (default = all active personas in personas/index.ts)
              Return sim_id; UI starts polling

3. FAN OUT    For each persona, in parallel via p-limit(5):
              │
              ├─ Build prompt:
              │    SYSTEM: persona.profile_md + voice instructions
              │    USER: event.summary + event.raw_text (truncated)
              │    OUTPUT: structured JSON matching Reaction schema
              │
              ├─ Call Claude with tool-use / structured output mode
              │
              └─ Append Reaction to simulation.reactions; persist JSON

4. COMPLETE   When all reactions done → simulation.status = 'complete'
              Save final JSON; UI polling sees this, renders results
```

### 6.1 Prompt template

```
SYSTEM:
You are simulating the public investment view of {persona.name}, a primary
dealer. Speak in their established house voice — confident, specific to
their typical positioning, not generic.

PERSONA PROFILE:
{persona.profile_md}

INSTRUCTIONS:
- Produce a structured JSON response matching the schema provided.
- Be honest about uncertainty. If the event is outside this persona's
  normal coverage, use low confidence rather than inventing detail.
- Do not contradict the persona's documented house view without explicitly
  noting the change in reasoning_md.
- reasoning_md should be 2-3 paragraphs in {persona.name}'s voice, citing
  specific elements of their profile (e.g., "consistent with our view that...").

USER:
EVENT (occurring {event.event_date}):
{event.summary}

FULL TEXT:
{event.raw_text}

Respond with the structured JSON only.
```

### 6.2 Reaction schema (Anthropic tool-use)

The LLM is forced to return a single tool call matching the `Reaction` TypeScript schema, ensuring valid structured output.

---

## 7. UI specification

### 7.1 Landing page (`/`)

```
┌─────────────────────────────────────────────────────────┐
│  MarketSounding                              [About]    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  A market-soundings sandbox for the Markets desk        │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Paste a market event...                          │  │
│  │  (FOMC statement, press release, news headline…)  │  │
│  └───────────────────────────────────────────────────┘  │
│                              [ Run sounding → ]         │
│                                                         │
│  ─── or try a sample ───                                │
│                                                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│  │ FOMC, Mar    │ │ CPI Release  │ │ Geopolitical │     │
│  │ 2026         │ │ Apr 2026     │ │ shock        │     │
│  └──────────────┘ └──────────────┘ └──────────────┘     │
│                                                         │
│  Recent soundings                                       │
│  • CPI Release, April 2026 — 2 days ago         [open]  │
│  • FOMC Statement, March 2026 — 1 week ago      [open]  │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Simulation page — running state (`/sim/[id]`)

```
┌─────────────────────────────────────────────────────────┐
│  Sounding: FOMC Statement, March 2026                   │
│  Started 12s ago · 3 of 5 personas complete             │
│                                                         │
│  ✓ GS    ✓ JPM   ✓ MS   ⟳ Citi   ⟳ BofA                 │
│                                                         │
│  [progress bar 60%]                                     │
└─────────────────────────────────────────────────────────┘
```

Polling interval: 1500ms.

### 7.3 Simulation page — complete state (`/sim/[id]`)

```
┌─────────────────────────────────────────────────────────┐
│  ← Back · FOMC Statement · March 19, 2026               │
│                                                         │
│  Summary: Fed held rates at 5.25-5.50%, more cautious   │
│  tone on services inflation, dropped "ongoing cuts."    │
│                                                         │
│  ⚠ Simulated views — not actual dealer commentary       │
│                                                         │
│  Hawkish ●●─●─●──────────● Dovish                       │
│            BofA Citi MS  JPM  GS                        │
│  (click to sort)                                        │
│                                                         │
│  Persona | Rate path  | Bal sheet | Risk | H/D | Conf   │
│  --------|------------|-----------|------|-----|------  │
│  ▸ GS    | 50bp Sep   | QT thru Q3| Bull | +0.3| 0.7    │
│  ▸ JPM   | 25bp Jul   | Slow QT   | Neut | +0.1| 0.6    │
│  ▸ MS    | No cuts'26 | Cont QT   | Bear | +0.6| 0.8    │
│  ...                                                    │
│                                                         │
│  (clicking ▸ expands inline reasoning + 'simulated' chip)│
└─────────────────────────────────────────────────────────┘
```

### 7.4 About page (`/about`)

Brief project description, the production roadmap diagram (Phases 1-4), and credits to MiroFish for inspiration. ~1 minute of read time, designed to answer judge questions.

---

## 8. 48-hour timeline

| Block | Hours | Goal |
|---|---|---|
| 0. Setup | 0-2 | Scaffold Next.js + shadcn + Tremor; install Anthropic SDK; deploy "Hello World" to Amplify *first* (de-risk deployment); set `ANTHROPIC_API_KEY` env var |
| 1. Personas | 2-5 | Author 5 persona profiles in `personas/index.ts` with Claude's help; define Reaction TypeScript schema |
| 2. Sim engine | 5-10 | `/api/sim/run`, `/api/sim/[id]`; structured-output prompt; parallel fan-out via p-limit; JSON file storage; smoke test with curl |
| 3. Results page | 10-18 | `/sim/[id]` with table, expandable rows, hawkish/dovish color coding, status polling |
| 4. Landing page | 18-24 | `/` with hero + 3 sample event cards + recent simulations list |
| 5. Tremor strip | 24-28 | Hawkish/dovish spectrum bar across top of results; click to sort |
| 6. Loading polish | 28-32 | Staggered persona-avatar animation, looks alive |
| 7. About page | 32-36 | Brief project page with roadmap diagram for judges |
| 8. Sample events | 36-40 | Bake in 3 events as JSON; pretty cards on landing |
| 9. AWS deploy + smoke | 40-44 | Final Amplify deploy; full demo flow on the live URL; check from clean browser |
| 10. Demo prep | 44-48 | Pitch script, slides if needed, rehearse the demo flow 3x, fix anything that breaks |

**Buffer:** zero. Everything is allocated. Cut order if behind: Tremor strip first, then About page, then loading animation polish.

---

## 9. The demo moment (engineer the build to serve this)

The 90-second pitch should land like this:

1. Land on `/` — clean hero, 3 sample event cards
2. Click "FOMC Statement, Mar 2026" sample → instant navigation to `/sim/abc123`
3. Loading screen: 5 dealer avatars light up one by one over ~25 seconds, "GS thinking… JPM thinking…"
4. Results page snaps in: table with 5 rows, hawkish/dovish color band, top concerns visible
5. Click GS row → expands inline, shows 2 paragraphs in Goldman's voice (with `simulated` chip)
6. Click hawkish/dovish strip → reorders table by score. Brief "oh, the room is split" moment
7. Cut to `/about` for 10 seconds — show roadmap (Roundtable, FOMC personas, AWS-native production stack)

Everything in the build serves that ~2-minute demo.

---

## 10. Reference material from MiroFish

Three Python files + the README, dropped into `docs/inspiration/` as read-only reference:

| File | What it informs in MarketSounding |
|---|---|
| `oasis_profile_generator.py` | Persona-generation prompt patterns |
| `simulation_config_generator.py` | LLM-driven structured config patterns |
| `report_agent.py` | ReACT scaffolding and structured-output patterns |
| `MIROFISH_README.md` | Pitch language and "swarm intelligence" framing |

These do not run, are not imported, and are not built. They exist to save re-derivation time during the hackathon.

---

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Anthropic API rate limit hit during demo | Pre-warm with sample sim during setup; cache one fully-completed sim as a "fallback" demo result |
| AWS Amplify deploy breaks late | Deploy "Hello World" in Hour 0-2, not Hour 40; iterate deploys throughout |
| Persona output sounds too generic | Write *opinionated* profiles with specific named voices, recent calls, distinctive positioning |
| Internet flaky during pitch | Pre-record a 60-second demo video as backup |
| Judges ask "is this real?" | Disclaimer chips throughout + the production roadmap slide answers in 10 seconds |
| Solo dev runs out of time | Cut order documented in §8 (Tremor strip → About page → loading polish) |

---

## 12. What's explicitly NOT in this build

The following are intentionally deferred to post-hackathon (see `production-roadmap.md`):

- Multi-turn roundtable transcript (Phase 2)
- Counterfactual / scenario branching (Phase 2)
- Buy-side personas, FOMC personas (Phase 2-3)
- Bedrock + KB + DynamoDB + Cognito migration (Phase 1.5)
- RAG corpus + scraper + persona seeding pipeline (Phase 1.5)
- PDF upload, exports, history, profile editor (Phase 2)
- Auth, multi-user, sharing (Phase 2)
- Live news feed integration (Phase 3)
- Streaming output, scheduled corpus refresh (Phase 2)

---

## 13. Success criteria for the hackathon

1. **Demo runs end-to-end on a public URL** without manual intervention
2. **All 5 personas produce plausibly-voiced reactions** to all 3 sample events
3. **The hawkish/dovish strip visibly differentiates** the personas (not all clustered)
4. **Click-row-to-expand works smoothly** — the "click GS" demo moment is reliable
5. **Disclaimers are visible** in every output element
6. **Pitch fits in 90 seconds** with time to answer 1-2 judge questions

---

## 14. File / repo layout (target end state)

```
~/Documents/MarketSounding/
├── README.md
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── .env.local                          # ANTHROPIC_API_KEY (gitignored)
├── .env.example
├── app/
│   ├── layout.tsx
│   ├── page.tsx                        # /
│   ├── about/page.tsx                  # /about
│   ├── sim/[id]/page.tsx               # /sim/[id]
│   └── api/
│       ├── sim/run/route.ts
│       ├── sim/[id]/route.ts
│       ├── personas/route.ts
│       └── events/samples/route.ts
├── components/
│   ├── ui/                             # shadcn components
│   ├── PersonaTable.tsx
│   ├── HawkishDovishStrip.tsx
│   ├── SimLoadingScreen.tsx
│   └── SampleEventCard.tsx
├── lib/
│   ├── anthropic.ts                    # Claude client wrapper
│   ├── simulation-runner.ts            # orchestration
│   ├── persona-agent.ts                # one-persona LLM call
│   ├── storage.ts                      # JSON file read/write
│   └── prompts.ts                      # prompt templates
├── personas/
│   └── index.ts                        # 5 persona records
├── data/
│   ├── sample-events/                  # 3 baked-in events
│   ├── events/                         # user-submitted events
│   └── sims/                           # simulation results
├── docs/
│   ├── specs/
│   │   ├── 2026-05-14-marketsounding-hackathon-design.md   # this doc
│   │   └── 2026-05-14-marketsounding-production-roadmap.md
│   └── inspiration/
│       ├── oasis_profile_generator.py
│       ├── simulation_config_generator.py
│       ├── report_agent.py
│       └── MIROFISH_README.md
└── amplify.yml                         # Amplify build config
```
