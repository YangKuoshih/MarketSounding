# MarketSounding Hackathon Build — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a 48-hour hackathon demo of MarketSounding — a Next.js app that simulates how 5 primary dealer personas (GS, JPM, MS, Citi, BofA) would react to a market event, returning a comparative reaction brief on a single results page.

**Architecture:** Next.js 15 (App Router, TypeScript) full-stack app. API routes orchestrate parallel Anthropic Claude calls (one per persona) using `p-limit` for concurrency. Persona profiles live as a TypeScript data file. Simulation results persist as one JSON object per reaction in S3 (production) or local filesystem (dev). UI is shadcn/ui + Tremor over Tailwind.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Tremor, Anthropic SDK (Claude Sonnet 4.5), AWS SDK v3 (S3 only), p-limit, vitest, AWS Amplify (hosting).

**Authoritative spec:** `~/Documents/MarketSounding/docs/specs/2026-05-14-marketsounding-hackathon-design.md` — read this before starting any chunk. The spec is the source of truth; this plan implements it.

**Non-goals:** This plan does NOT cover the production roadmap (Bedrock, KB, DynamoDB, Cognito, RAG, scraper, Roundtable, FOMC personas, etc.). Those live in `production-roadmap.md` and are explicitly out of scope for the 48-hour build.

---

## File Structure (target end state)

Each file has one clear responsibility. Files that change together live together.

```
app/
  layout.tsx                       # Root layout, fonts, theme provider, persistent disclaimer
  globals.css                      # Tailwind directives + theme tokens
  page.tsx                         # / Landing page
  about/page.tsx                   # /about
  sim/[id]/page.tsx                # /sim/[id] handles both running + complete states
  api/
    sim/run/route.ts               # POST: create event, create sim, kick off fan-out
    sim/[id]/route.ts              # GET: read sim.json + reactions/, return merged view
    personas/route.ts              # GET: list active personas (drives persona chips)
    events/samples/route.ts        # GET: list baked-in sample events
components/
  ui/                              # shadcn primitives (auto-generated)
  persona-table.tsx                # Comparative table + sort handler
  persona-row-expanded.tsx         # Expanded row content (reasoning + chip)
  hawkish-dovish-strip.tsx         # Tremor Tracker strip across top of results
  sim-loading-screen.tsx           # Persona avatars filling in animation
  sample-event-card.tsx            # Landing page event cards
  disclaimer-banner.tsx            # "Simulated views" persistent banner
lib/
  types.ts                         # All TypeScript types (Persona, Event, Simulation, Reaction)
  anthropic.ts                     # Anthropic SDK client wrapper + tool-use config
  prompts.ts                       # Prompt template builder (pure function)
  persona-agent.ts                 # One-persona LLM call: prompt → Claude → parsed Reaction
  simulation-runner.ts             # Orchestration: fan out N persona-agents in parallel
  storage.ts                       # Adapter: S3 (prod) or local FS (dev), chosen by env
  id.ts                            # Short ID generator
  truncate.ts                      # Truncate event raw_text to 12000 chars
personas/
  index.ts                         # 5 persona records (GS, JPM, MS, Citi, BofA)
data/
  sample-events/
    fomc-mar-2026.json
    cpi-apr-2026.json
    geopolitical-mar-2026.json
    _fallback-sim.json             # Pre-baked sim result for demo fallback
  events/                          # User-submitted events (local dev only)
  sims/                            # Per-sim subdir: sim.json + reactions/<persona_id>.json
tests/
  storage.test.ts
  prompts.test.ts
  persona-agent.test.ts
  simulation-runner.test.ts
  truncate.test.ts
package.json
tsconfig.json
tailwind.config.ts
next.config.ts
amplify.yml                        # Amplify build config
.env.example
.env.local                         # gitignored
README.md
```

Why these splits:
- `lib/` is pure logic — testable without Next.js context
- `components/` is presentation — manual smoke tested
- `app/api/` routes are thin wrappers over `lib/` — smoke tested with curl
- `data/` is gitignored at runtime (`sims/`, `events/`) but `sample-events/` is committed

---

## Chunks Overview

| Chunk | Name | Maps to spec block(s) |
|---|---|---|
| 1 | Project setup & deploy pipeline | Block 0 (hours 0-2) |
| 2 | Types + personas + sample events | Block 1 (hours 2-5) |
| 3 | Storage adapter | Early Block 2 |
| 4 | Prompt builder + persona-agent | Block 2 |
| 5 | Simulation runner + API routes | Block 2 finish (hour 10) |
| 6 | Results page UI | Block 3 (hours 10-18) |
| 7 | Landing page + sample events UI | Block 4 (hours 18-24) |
| 8 | Hawkish/dovish strip + About page | Blocks 5 + 7 (hours 24-36) |
| 9 | Polish, fallback demo, deploy, demo prep | Blocks 8-10 (hours 36-48) |

---

## Chunk 1: Project setup & deploy pipeline

**Goal:** A "Hello MarketSounding" Next.js app deployed to AWS Amplify with `ANTHROPIC_API_KEY` and AWS env vars wired. De-risk deployment in hour 0, not hour 40.

### Task 1.1: Scaffold Next.js project

**Files:**
- Create: `~/Documents/MarketSounding/` (project root, already exists with docs/)

- [ ] **Step 1: Run create-next-app**

```bash
cd ~/Documents/MarketSounding
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --eslint --use-npm
```

Expected: prompts for "OK to proceed" → Yes. Files generated. The existing `docs/` folder is preserved (create-next-app does not delete unrelated dirs).

- [ ] **Step 2: Verify dev server runs**

```bash
npm run dev
```

Expected: server starts on `http://localhost:3000`. Default Next.js page renders. Stop with Ctrl-C.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 with TypeScript, Tailwind, App Router"
```

### Task 1.2: Install runtime dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Anthropic SDK + AWS SDK + p-limit**

```bash
npm install @anthropic-ai/sdk @aws-sdk/client-s3 p-limit nanoid
```

Expected: 4 packages added to `dependencies`.

- [ ] **Step 2: Install Tremor**

```bash
npm install @tremor/react
```

Expected: package added.

- [ ] **Step 3: Install dev dependencies**

```bash
npm install -D vitest @vitest/ui happy-dom @types/node
```

Expected: vitest and helpers in `devDependencies`.

- [ ] **Step 4: Add test script to package.json**

Edit `package.json` `scripts`:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 5: Create vitest.config.ts**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: install runtime deps (anthropic, aws-sdk, p-limit, tremor) and vitest"
```

### Task 1.3: Initialize shadcn/ui

**Files:**
- Create: `components.json`, `lib/utils.ts`, `components/ui/*`

- [ ] **Step 1: Run shadcn init**

```bash
npx shadcn@latest init -d
```

Expected: prompts answered with defaults, `components.json` and `lib/utils.ts` created. Tailwind config updated.

- [ ] **Step 2: Add core shadcn components**

```bash
npx shadcn@latest add button card badge table textarea separator skeleton
```

Expected: components appear in `components/ui/`.

- [ ] **Step 3: Verify import works**

Edit `app/page.tsx` to add `import { Button } from "@/components/ui/button";` at top, then add `<Button>Hello</Button>` somewhere. Run `npm run dev`, open `http://localhost:3000`, see the styled button.

- [ ] **Step 4: Revert the test edit, commit shadcn setup**

```bash
git checkout app/page.tsx
git add -A
git commit -m "chore: init shadcn/ui with button, card, badge, table, textarea, separator, skeleton"
```

### Task 1.4: .env handling and gitignore

**Files:**
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Write .env.example**

```bash
# Anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-5

# Storage backend: 'local' (default) or 's3'
STORAGE_BACKEND=local

# S3 (only required when STORAGE_BACKEND=s3)
AWS_REGION=us-east-1
S3_BUCKET=marketsounding-data
# AWS credentials come from Amplify IAM role in production
# For local dev, set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY if testing S3

# Optional concurrency override (defaults to 5)
MAX_PARALLEL_PERSONAS=5
```

- [ ] **Step 2: Update .gitignore**

Append to `.gitignore`:
```
# MarketSounding
.env.local
data/sims/
data/events/
```

- [ ] **Step 3: Create .env.local locally**

```bash
cp .env.example .env.local
# Manually edit .env.local to add real ANTHROPIC_API_KEY (not committed)
```

- [ ] **Step 4: Commit**

```bash
git add .env.example .gitignore
git commit -m "chore: add .env.example and gitignore data dirs and .env.local"
```

### Task 1.5: Hello world deploy to AWS Amplify

**Files:**
- Create: `amplify.yml`
- Modify: `app/page.tsx` (temporary hello content)

- [ ] **Step 1: Replace app/page.tsx with branded hello**

```tsx
// app/page.tsx
export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">MarketSounding</h1>
        <p className="mt-4 text-muted-foreground">
          A market-soundings sandbox for the Markets desk.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">Coming soon.</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create amplify.yml**

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

- [ ] **Step 3: Push to GitHub**

```bash
gh repo create MarketSounding --private --source=. --remote=origin --push
```

(If `gh` not authenticated, manually create repo at github.com and run `git remote add origin ...; git push -u origin main`.)

- [ ] **Step 4: Connect Amplify in AWS Console**

In AWS Console → Amplify → Host web app → GitHub → select MarketSounding repo → main branch. Use the auto-detected build settings (`amplify.yml` will be used). Add env var `ANTHROPIC_API_KEY` in Amplify build settings (will be needed later but set now). Click Save and Deploy.

Expected: build succeeds in ~3-5 minutes. Public URL like `https://main.d1abc.amplifyapp.com` works and shows "MarketSounding — Coming soon."

- [ ] **Step 5: Commit**

```bash
git add amplify.yml app/page.tsx
git commit -m "feat: hello-world landing + amplify build config; verified deploy"
git push
```

---

## Chunk 2: Types + personas + sample events

**Goal:** Define the canonical data types and author all the static demo content (5 personas + 3 sample events). After this chunk, all the *content* exists; the engine doesn't yet.

### Task 2.1: Write lib/types.ts

**Files:**
- Create: `lib/types.ts`

- [ ] **Step 1: Write the types**

```ts
// lib/types.ts

export type PersonaType = 'primary_dealer'; // (Phase 2: 'buy_side' | 'fomc')

export type Persona = {
  id: string;                          // 'gs', 'jpm', 'ms', 'citi', 'bofa'
  name: string;                        // 'Goldman Sachs'
  short_name: string;                  // 'GS'
  type: PersonaType;
  profile_md: string;                  // ~1 page house-view brief
  hawkish_dovish_bias: number;         // -1..+1 prior
  avatar_text: string;                 // 'GS' (2 chars)
};

export type Event = {
  id: string;
  title: string;
  source: 'pasted' | 'sample';
  raw_text: string;
  summary: string | null;              // LLM-generated, may be null on submit
  event_date: string;                  // ISO date
  created_at: string;                  // ISO timestamp
};

export type SimulationStatus = 'queued' | 'running' | 'complete' | 'failed';

export type Simulation = {
  id: string;
  event_id: string;
  status: SimulationStatus;
  persona_ids: string[];
  created_at: string;
  completed_at: string | null;
  error: string | null;
};

export type ReactionStatus = 'complete' | 'failed';

export type Reaction = {
  persona_id: string;
  status: ReactionStatus;
  rate_path_view: string;              // 1 sentence
  balance_sheet_view: string;          // 1 sentence
  risk_asset_view: string;             // 1 sentence
  key_concerns: string[];              // 1-3 strings
  hawkish_dovish_score: number;        // -1..+1
  confidence: number;                  // 0..1
  reasoning_md: string;                // 2-3 paragraphs
  error: string | null;                // populated only on status='failed'
};

// API response types
export type SimulationView = Simulation & {
  reactions: Reaction[];
  event: Event;
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add canonical TypeScript types for Persona, Event, Simulation, Reaction"
```

### Task 2.2: Author 5 persona profiles

**Files:**
- Create: `personas/index.ts`

This is content-engineering. Each profile should be opinionated, name specific economists/strategists, and capture distinctive positioning. ~30 minutes per persona is the budget.

- [ ] **Step 1: Create personas/index.ts skeleton**

```ts
// personas/index.ts
import type { Persona } from '@/lib/types';

export const PERSONAS: Persona[] = [
  // Five entries follow — see steps below
];

export const PERSONA_BY_ID: Record<string, Persona> = Object.fromEntries(
  PERSONAS.map((p) => [p.id, p])
);
```

- [ ] **Step 2: Author Goldman Sachs (GS)**

Add to PERSONAS array:
```ts
{
  id: 'gs',
  name: 'Goldman Sachs',
  short_name: 'GS',
  type: 'primary_dealer',
  avatar_text: 'GS',
  hawkish_dovish_bias: -0.2,
  profile_md: `# Goldman Sachs (GS)
**Key voices:** David Mericle (chief US economist), Jan Hatzius
**House style:** Data-driven, model-heavy, comfortable taking out-of-consensus calls. Often early to call cycle turns. Famous for the "this time is different" willingness when the data warrants it.
**Recent positioning:** Constructive on disinflation. Sees three 25bp cuts in 2026, first in June. Skeptical that services inflation will stay sticky.
**Typical concerns:** Wage stickiness, immigration policy effects on labor supply, fiscal trajectory.
**What they typically get wrong:** Tend to underweight political risk to Fed independence; have been late to cycle turns historically (2022 inflation call).
**Voice:** Confident, technical, citation-heavy. Likes to anchor calls in their own model output.`,
},
```

- [ ] **Step 3: Author JP Morgan (JPM)**

```ts
{
  id: 'jpm',
  name: 'JP Morgan',
  short_name: 'JPM',
  type: 'primary_dealer',
  avatar_text: 'JP',
  hawkish_dovish_bias: 0.1,
  profile_md: `# JP Morgan (JPM)
**Key voices:** Michael Feroli (chief US economist), Bruce Kasman
**House style:** Slightly hawkish lean vs. consensus. Heavy emphasis on labor market dynamics and wage data.
**Recent positioning:** One 25bp cut in July, then on hold through year-end. Sees risks tilted to a slower cutting cycle than market pricing.
**Typical concerns:** Labor market remains "too tight," services inflation embedded in wage trends, recession risk lower than market believes.
**What they typically get wrong:** Sometimes too anchored to "long and variable lags" framing; can be slow to update on inflation surprises.
**Voice:** Methodical, balanced, lots of "however" and "on the other hand."`,
},
```

- [ ] **Step 4: Author Morgan Stanley (MS)**

```ts
{
  id: 'ms',
  name: 'Morgan Stanley',
  short_name: 'MS',
  type: 'primary_dealer',
  avatar_text: 'MS',
  hawkish_dovish_bias: 0.5,
  profile_md: `# Morgan Stanley (MS)
**Key voices:** Ellen Zentner (chief US economist), Mike Wilson (equity strategy)
**House style:** Cautious-to-hawkish on rates, often bearish on risk assets at cycle peaks. Strong emphasis on financial conditions.
**Recent positioning:** No cuts in 2026 as base case. Sees Fed re-engaging hawkish stance if services inflation re-accelerates.
**Typical concerns:** Wage-price spiral, financial conditions easing too much, asset bubbles, fiscal dominance.
**What they typically get wrong:** Persistent bearish bias on equities; can be early on calls (right thesis, wrong timing).
**Voice:** Cautious, scenario-heavy, "tail risk" framing common. Emphasizes asymmetry.`,
},
```

- [ ] **Step 5: Author Citi**

```ts
{
  id: 'citi',
  name: 'Citi',
  short_name: 'Citi',
  type: 'primary_dealer',
  avatar_text: 'CT',
  hawkish_dovish_bias: 0.0,
  profile_md: `# Citi
**Key voices:** Andrew Hollenhorst (chief US economist), Veronica Clark
**House style:** Macro-data-driven, regularly publishes detailed prints reaction notes. Moderate consensus lean.
**Recent positioning:** Two 25bp cuts in 2026 (Sep + Dec). Watches core services ex-housing closely as the swing factor.
**Typical concerns:** Sticky core services inflation, labor market normalization pace, balance sheet runoff timing.
**What they typically get wrong:** Tends to follow the herd on directional calls; rarely takes contrarian stance on the rate path.
**Voice:** Print-focused, references specific data series and prior FOMC language. Heavy use of "we expect" and "our forecast."`,
},
```

- [ ] **Step 6: Author Bank of America (BofA)**

```ts
{
  id: 'bofa',
  name: 'Bank of America',
  short_name: 'BofA',
  type: 'primary_dealer',
  avatar_text: 'BA',
  hawkish_dovish_bias: 0.3,
  profile_md: `# Bank of America (BofA)
**Key voices:** Michael Gapen (chief US economist), Aditya Bhave
**House style:** Consumer-focused, leans hawkish on services inflation persistence. Strong global macro overlay.
**Recent positioning:** Sees the Fed cutting only once in 2026 if at all. Most hawkish of the major dealers on services CPI.
**Typical concerns:** Resilient consumer keeping services inflation elevated, immigration-driven supply offsetting demand cooling, global rate divergence.
**What they typically get wrong:** Hawkish bias has cost them on calls when consumer demand softens unexpectedly.
**Voice:** Consumer-spending-anchored, often references credit card data and BofA proprietary spending indicators.`,
},
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add personas/index.ts
git commit -m "feat: author 5 primary dealer personas (GS, JPM, MS, Citi, BofA)"
```

### Task 2.3: Author 3 sample events as JSON

**Files:**
- Create: `data/sample-events/fomc-mar-2026.json`
- Create: `data/sample-events/cpi-apr-2026.json`
- Create: `data/sample-events/geopolitical-mar-2026.json`

Use real public text where possible. For the hackathon, paraphrased/representative versions are fine if true sources are missing.

- [ ] **Step 1: Write fomc-mar-2026.json**

```json
{
  "id": "sample-fomc-mar-2026",
  "title": "FOMC Statement, March 2026",
  "source": "sample",
  "event_date": "2026-03-19",
  "raw_text": "The Federal Open Market Committee decided today to maintain the target range for the federal funds rate at 5-1/4 to 5-1/2 percent. Recent indicators suggest that economic activity has been expanding at a solid pace. Job gains have moderated since early in the year but remain strong. The unemployment rate has edged up but remains low. Inflation has eased over the past year but remains elevated. In recent months, there has been a lack of further progress toward the Committee's 2 percent inflation objective. The Committee judges that the risks to achieving its employment and inflation goals have moved into better balance. The Committee does not expect it will be appropriate to reduce the target range until it has gained greater confidence that inflation is moving sustainably toward 2 percent. The Committee will continue reducing its holdings of Treasury securities and agency debt. In considering any adjustments to the target range, the Committee will carefully assess incoming data, the evolving outlook, and the balance of risks.",
  "summary": "Fed held rates at 5.25–5.50%, struck a cautious tone on services inflation persistence, and notably dropped reference to ongoing cuts in the rate-path forward guidance.",
  "created_at": "2026-03-19T18:00:00Z"
}
```

- [ ] **Step 2: Write cpi-apr-2026.json**

```json
{
  "id": "sample-cpi-apr-2026",
  "title": "CPI Release, April 2026",
  "source": "sample",
  "event_date": "2026-04-10",
  "raw_text": "The Consumer Price Index for All Urban Consumers (CPI-U) increased 0.4 percent in March on a seasonally adjusted basis, after rising 0.4 percent in February. Over the last 12 months, the all items index increased 3.5 percent before seasonal adjustment. The index for shelter rose along with the index for gasoline. Combined, these two indexes contributed over half of the monthly increase in the all items index. The energy index rose 1.1 percent over the month. The food index rose 0.1 percent in March. The food at home index was unchanged, while the food away from home index rose 0.3 percent over the month. The index for all items less food and energy rose 0.4 percent in March, as it did in each of the 2 preceding months. The shelter index rose 0.4 percent over the month. The index for medical care rose in March, as did the indexes for motor vehicle insurance, apparel, and personal care.",
  "summary": "March CPI rose 0.4% MoM, above 0.3% consensus. Core CPI up 0.4% for third straight month. YoY headline at 3.5%, core at 3.8%. Shelter and energy drove the upside.",
  "created_at": "2026-04-10T12:30:00Z"
}
```

- [ ] **Step 3: Write geopolitical-mar-2026.json**

```json
{
  "id": "sample-geopolitical-mar-2026",
  "title": "Middle East shock — oil up 8% intraday",
  "source": "sample",
  "event_date": "2026-03-25",
  "raw_text": "Brent crude oil rose more than 8% intraday on news of escalating tensions in the Persian Gulf region following an attack on a major shipping route. WTI futures spiked above $95 per barrel, the highest level since 2024. Equity markets sold off sharply, with the S&P 500 down 2.3% and the VIX spiking above 25. Treasury yields initially fell on a flight-to-quality bid, with the 10-year yield dropping 12 basis points before recovering. The dollar strengthened against most major currencies. Gold reached a new all-time high above $2,400 per ounce. Markets are now pricing in a meaningful inflation risk premium and questioning whether the Federal Reserve can continue to focus on services disinflation if energy passes through to broader prices.",
  "summary": "Geopolitical shock in the Persian Gulf drives oil +8% intraday, equities -2.3%, 10y yields initially down 12bp on flight-to-quality. Markets re-pricing inflation premium.",
  "created_at": "2026-03-25T15:00:00Z"
}
```

- [ ] **Step 4: Commit**

```bash
git add data/sample-events/
git commit -m "feat: add 3 baked-in sample events (FOMC Mar 2026, CPI Apr 2026, geopolitical shock)"
```

### Task 2.4: Sample event loader

**Files:**
- Create: `lib/sample-events.ts`
- Create: `tests/sample-events.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/sample-events.test.ts
import { describe, it, expect } from 'vitest';
import { loadSampleEvents, getSampleEvent } from '@/lib/sample-events';

describe('sample-events', () => {
  it('loads all 3 sample events', async () => {
    const events = await loadSampleEvents();
    expect(events).toHaveLength(3);
    const ids = events.map((e) => e.id);
    expect(ids).toContain('sample-fomc-mar-2026');
    expect(ids).toContain('sample-cpi-apr-2026');
    expect(ids).toContain('sample-geopolitical-mar-2026');
  });

  it('returns one sample by id', async () => {
    const e = await getSampleEvent('sample-fomc-mar-2026');
    expect(e).not.toBeNull();
    expect(e!.title).toContain('FOMC');
  });

  it('returns null for unknown id', async () => {
    const e = await getSampleEvent('does-not-exist');
    expect(e).toBeNull();
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

```bash
npm test -- sample-events
```

Expected: fails because `@/lib/sample-events` does not exist.

- [ ] **Step 3: Implement lib/sample-events.ts**

```ts
// lib/sample-events.ts
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { Event } from '@/lib/types';

const SAMPLE_DIR = path.join(process.cwd(), 'data', 'sample-events');

export async function loadSampleEvents(): Promise<Event[]> {
  const files = await readdir(SAMPLE_DIR);
  const eventFiles = files.filter(
    (f) => f.endsWith('.json') && !f.startsWith('_'),
  );
  const events = await Promise.all(
    eventFiles.map(async (f) => {
      const raw = await readFile(path.join(SAMPLE_DIR, f), 'utf-8');
      return JSON.parse(raw) as Event;
    }),
  );
  return events.sort((a, b) => b.event_date.localeCompare(a.event_date));
}

export async function getSampleEvent(id: string): Promise<Event | null> {
  const events = await loadSampleEvents();
  return events.find((e) => e.id === id) ?? null;
}
```

- [ ] **Step 4: Run test, verify PASS**

```bash
npm test -- sample-events
```

Expected: 3/3 pass.

- [ ] **Step 5: Commit**

```bash
git add lib/sample-events.ts tests/sample-events.test.ts
git commit -m "feat(lib): sample event loader with passing tests"
```

---

## Chunk 3: Storage adapter

**Goal:** A storage interface with two implementations (local FS and S3) chosen by env. The adapter is the only file that knows where bytes go.

### Task 3.1: Storage adapter interface + local FS impl

**Files:**
- Create: `lib/storage.ts`
- Create: `tests/storage.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/storage.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createStorage } from '@/lib/storage';

const TEST_ROOT = path.join(process.cwd(), 'tmp-test-data');

describe('storage (local backend)', () => {
  beforeEach(async () => {
    await rm(TEST_ROOT, { recursive: true, force: true });
    await mkdir(TEST_ROOT, { recursive: true });
  });

  it('writes and reads a JSON object', async () => {
    const storage = createStorage({ backend: 'local', root: TEST_ROOT });
    await storage.putJson('foo/bar.json', { hello: 'world' });
    const got = await storage.getJson<{ hello: string }>('foo/bar.json');
    expect(got).toEqual({ hello: 'world' });
  });

  it('returns null for missing key', async () => {
    const storage = createStorage({ backend: 'local', root: TEST_ROOT });
    const got = await storage.getJson('nope.json');
    expect(got).toBeNull();
  });

  it('lists keys under a prefix', async () => {
    const storage = createStorage({ backend: 'local', root: TEST_ROOT });
    await storage.putJson('sims/abc/reactions/gs.json', { persona_id: 'gs' });
    await storage.putJson('sims/abc/reactions/jpm.json', { persona_id: 'jpm' });
    await storage.putJson('sims/xyz/reactions/gs.json', { persona_id: 'gs' });
    const keys = await storage.list('sims/abc/reactions/');
    expect(keys).toHaveLength(2);
    expect(keys).toContain('sims/abc/reactions/gs.json');
    expect(keys).toContain('sims/abc/reactions/jpm.json');
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
npm test -- storage
```

Expected: fails (`createStorage` not defined).

- [ ] **Step 3: Implement lib/storage.ts (local backend only first)**

```ts
// lib/storage.ts
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export type StorageBackend = 'local' | 's3';

export type StorageConfig =
  | { backend: 'local'; root: string }
  | { backend: 's3'; bucket: string; region: string };

export type Storage = {
  putJson<T>(key: string, value: T): Promise<void>;
  getJson<T>(key: string): Promise<T | null>;
  list(prefix: string): Promise<string[]>;
};

export function createStorage(cfg: StorageConfig): Storage {
  if (cfg.backend === 'local') return createLocalStorage(cfg.root);
  return createS3Storage(cfg.bucket, cfg.region);
}

function createLocalStorage(root: string): Storage {
  const abs = (key: string) => path.join(root, key);

  return {
    async putJson(key, value) {
      const filepath = abs(key);
      await mkdir(path.dirname(filepath), { recursive: true });
      await writeFile(filepath, JSON.stringify(value, null, 2), 'utf-8');
    },
    async getJson(key) {
      try {
        const raw = await readFile(abs(key), 'utf-8');
        return JSON.parse(raw);
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw err;
      }
    },
    async list(prefix) {
      const abs_prefix = abs(prefix);
      try {
        const entries = await readdir(abs_prefix);
        const out: string[] = [];
        for (const entry of entries) {
          const full = path.join(abs_prefix, entry);
          const s = await stat(full);
          if (s.isFile() && entry.endsWith('.json')) {
            out.push(path.posix.join(prefix.replace(/\\/g, '/'), entry));
          }
        }
        return out;
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw err;
      }
    },
  };
}

function createS3Storage(_bucket: string, _region: string): Storage {
  throw new Error('S3 backend not yet implemented');
}
```

- [ ] **Step 4: Run, verify PASS**

```bash
npm test -- storage
```

Expected: 3/3 pass.

- [ ] **Step 5: Commit**

```bash
git add lib/storage.ts tests/storage.test.ts
git commit -m "feat(lib): storage adapter interface + local-FS impl with tests"
```

### Task 3.2: S3 backend implementation

**Files:**
- Modify: `lib/storage.ts` (replace `createS3Storage` stub)

- [ ] **Step 1: Implement createS3Storage**

Replace the stub with:

```ts
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  NoSuchKey,
} from '@aws-sdk/client-s3';

function createS3Storage(bucket: string, region: string): Storage {
  const client = new S3Client({ region });

  return {
    async putJson(key, value) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: JSON.stringify(value, null, 2),
          ContentType: 'application/json',
        }),
      );
    },
    async getJson(key) {
      try {
        const out = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: key }),
        );
        const text = await out.Body!.transformToString();
        return JSON.parse(text);
      } catch (err: unknown) {
        if (err instanceof NoSuchKey) return null;
        if ((err as { name?: string }).name === 'NoSuchKey') return null;
        throw err;
      }
    },
    async list(prefix) {
      const out = await client.send(
        new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }),
      );
      return (out.Contents ?? [])
        .map((o) => o.Key!)
        .filter((k) => k && k.endsWith('.json'));
    },
  };
}
```

- [ ] **Step 2: Verify local tests still pass**

```bash
npm test -- storage
```

Expected: still 3/3 pass (S3 path not exercised by tests).

- [ ] **Step 3: Commit**

```bash
git add lib/storage.ts
git commit -m "feat(lib): implement S3 backend for storage adapter"
```

### Task 3.3: Default storage factory (env-driven)

**Files:**
- Create: `lib/storage-default.ts`

- [ ] **Step 1: Write the factory**

```ts
// lib/storage-default.ts
import path from 'node:path';
import { createStorage, type Storage } from '@/lib/storage';

let cached: Storage | null = null;

export function getDefaultStorage(): Storage {
  if (cached) return cached;
  const backend = process.env.STORAGE_BACKEND ?? 'local';
  if (backend === 's3') {
    const bucket = process.env.S3_BUCKET;
    const region = process.env.AWS_REGION ?? 'us-east-1';
    if (!bucket) throw new Error('S3_BUCKET env var required when STORAGE_BACKEND=s3');
    cached = createStorage({ backend: 's3', bucket, region });
  } else {
    cached = createStorage({
      backend: 'local',
      root: path.join(process.cwd(), 'data'),
    });
  }
  return cached;
}
```

- [ ] **Step 2: Smoke test**

Create a temp script and run it:

```bash
cat > /tmp/storage-smoke.mjs << 'EOF'
import { getDefaultStorage } from './lib/storage-default.ts';
const s = getDefaultStorage();
await s.putJson('smoke-test/hello.json', { ok: true });
console.log(await s.getJson('smoke-test/hello.json'));
EOF
npx tsx /tmp/storage-smoke.mjs
```

(Install `tsx` if needed: `npm install -D tsx`)

Expected: prints `{ ok: true }`. Verify `data/smoke-test/hello.json` exists locally.

- [ ] **Step 3: Cleanup smoke artifact + commit**

```bash
rm -rf data/smoke-test /tmp/storage-smoke.mjs
git add lib/storage-default.ts package.json package-lock.json
git commit -m "feat(lib): default storage factory chooses backend by STORAGE_BACKEND env"
```

---

## Chunk 4: Prompt builder + persona-agent

**Goal:** A pure prompt-building function and a persona-agent that takes a Persona + Event and returns a Reaction via Anthropic tool-use.

### Task 4.1: Truncation helper

**Files:**
- Create: `lib/truncate.ts`
- Create: `tests/truncate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/truncate.test.ts
import { describe, it, expect } from 'vitest';
import { truncateText } from '@/lib/truncate';

describe('truncateText', () => {
  it('returns text unchanged when shorter than limit', () => {
    expect(truncateText('hello', 100)).toBe('hello');
  });

  it('truncates to limit and appends marker when longer', () => {
    const out = truncateText('a'.repeat(50), 10);
    expect(out.length).toBeLessThanOrEqual(40); // 10 + marker
    expect(out).toContain('… [truncated]');
  });

  it('uses default limit of 12000', () => {
    const out = truncateText('a'.repeat(20000));
    expect(out.length).toBeLessThan(12100);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
npm test -- truncate
```

- [ ] **Step 3: Implement**

```ts
// lib/truncate.ts
const DEFAULT_LIMIT = 12000;

export function truncateText(text: string, limit: number = DEFAULT_LIMIT): string {
  if (text.length <= limit) return text;
  return text.slice(0, limit) + '\n\n… [truncated]';
}
```

- [ ] **Step 4: Run, verify PASS**

```bash
npm test -- truncate
```

- [ ] **Step 5: Commit**

```bash
git add lib/truncate.ts tests/truncate.test.ts
git commit -m "feat(lib): truncation helper for event raw_text (default 12000 chars)"
```

### Task 4.2: Prompt builder

**Files:**
- Create: `lib/prompts.ts`
- Create: `tests/prompts.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/prompts.test.ts
import { describe, it, expect } from 'vitest';
import { buildPersonaPrompt } from '@/lib/prompts';
import type { Persona, Event } from '@/lib/types';

const persona: Persona = {
  id: 'gs',
  name: 'Goldman Sachs',
  short_name: 'GS',
  type: 'primary_dealer',
  avatar_text: 'GS',
  hawkish_dovish_bias: -0.2,
  profile_md: '# GS profile body',
};

const event: Event = {
  id: 'evt-1',
  title: 'Test event',
  source: 'sample',
  raw_text: 'Body text.',
  summary: '2-line summary.',
  event_date: '2026-05-14',
  created_at: '2026-05-14T00:00:00Z',
};

describe('buildPersonaPrompt', () => {
  it('includes persona profile in system prompt', () => {
    const { system } = buildPersonaPrompt(persona, event);
    expect(system).toContain('Goldman Sachs');
    expect(system).toContain('# GS profile body');
  });

  it('includes event summary and date in user prompt', () => {
    const { user } = buildPersonaPrompt(persona, event);
    expect(user).toContain('2-line summary.');
    expect(user).toContain('2026-05-14');
  });

  it('truncates long event raw_text', () => {
    const longEvent = { ...event, raw_text: 'x'.repeat(20000) };
    const { user } = buildPersonaPrompt(persona, longEvent);
    expect(user).toContain('[truncated]');
    expect(user.length).toBeLessThan(13000);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
npm test -- prompts
```

- [ ] **Step 3: Implement lib/prompts.ts**

```ts
// lib/prompts.ts
import type { Persona, Event } from '@/lib/types';
import { truncateText } from '@/lib/truncate';

export type BuiltPrompt = {
  system: string;
  user: string;
};

export function buildPersonaPrompt(persona: Persona, event: Event): BuiltPrompt {
  const system = `You are simulating the public investment view of ${persona.name}, a ${persona.type.replace('_', ' ')}. Speak in their established house voice — confident, specific to their typical positioning, not generic.

PERSONA PROFILE:
${persona.profile_md}

INSTRUCTIONS:
- Produce a structured tool call matching the reaction schema.
- Be honest about uncertainty. If the event is outside this persona's normal coverage, use low confidence rather than inventing detail.
- Do not contradict the persona's documented house view without explicitly noting the change in reasoning_md.
- reasoning_md should be 2-3 paragraphs in ${persona.name}'s voice, citing specific elements of their profile (e.g., "consistent with our view that...").`;

  const summary = event.summary ?? '(no summary available)';
  const body = truncateText(event.raw_text);

  const user = `EVENT (occurring ${event.event_date}):
${summary}

FULL TEXT:
${body}

Respond with the structured tool call only.`;

  return { system, user };
}
```

- [ ] **Step 4: Run, verify PASS**

```bash
npm test -- prompts
```

- [ ] **Step 5: Commit**

```bash
git add lib/prompts.ts tests/prompts.test.ts
git commit -m "feat(lib): persona prompt builder (pure function, tested)"
```

### Task 4.3: Anthropic client wrapper + tool schema

**Files:**
- Create: `lib/anthropic.ts`

- [ ] **Step 1: Write the client + tool definition**

```ts
// lib/anthropic.ts
import Anthropic from '@anthropic-ai/sdk';

let cached: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY env var is required');
  cached = new Anthropic({ apiKey });
  return cached;
}

export function getModel(): string {
  return process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5';
}

// Tool schema mirrors the Reaction type, minus the metadata fields the
// runtime sets (persona_id, status, error). The LLM only fills the
// substantive fields.
export const REACTION_TOOL = {
  name: 'submit_reaction',
  description:
    'Submit your structured reaction to the market event as the simulated persona.',
  input_schema: {
    type: 'object',
    properties: {
      rate_path_view: {
        type: 'string',
        description: 'Your view on the Fed rate path in 1 sentence.',
      },
      balance_sheet_view: {
        type: 'string',
        description: 'Your view on Fed balance sheet policy in 1 sentence.',
      },
      risk_asset_view: {
        type: 'string',
        description: 'Your positioning on risk assets in 1 sentence.',
      },
      key_concerns: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        maxItems: 3,
        description: '1 to 3 short strings naming your top concerns.',
      },
      hawkish_dovish_score: {
        type: 'number',
        minimum: -1,
        maximum: 1,
        description:
          'Your stance on a -1 (most dovish) to +1 (most hawkish) scale.',
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Confidence in this reaction, 0 to 1.',
      },
      reasoning_md: {
        type: 'string',
        description:
          '2-3 paragraphs of reasoning in the persona voice, markdown allowed.',
      },
    },
    required: [
      'rate_path_view',
      'balance_sheet_view',
      'risk_asset_view',
      'key_concerns',
      'hawkish_dovish_score',
      'confidence',
      'reasoning_md',
    ],
  },
} as const;

export type ReactionToolInput = {
  rate_path_view: string;
  balance_sheet_view: string;
  risk_asset_view: string;
  key_concerns: string[];
  hawkish_dovish_score: number;
  confidence: number;
  reasoning_md: string;
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/anthropic.ts
git commit -m "feat(lib): Anthropic client wrapper + REACTION_TOOL schema for structured output"
```

### Task 4.4: persona-agent (with mocked Anthropic in test)

**Files:**
- Create: `lib/persona-agent.ts`
- Create: `tests/persona-agent.test.ts`

- [ ] **Step 1: Write the failing test (mocked client)**

```ts
// tests/persona-agent.test.ts
import { describe, it, expect, vi } from 'vitest';
import { runPersonaAgent } from '@/lib/persona-agent';
import type { Persona, Event } from '@/lib/types';

const persona: Persona = {
  id: 'gs',
  name: 'Goldman Sachs',
  short_name: 'GS',
  type: 'primary_dealer',
  avatar_text: 'GS',
  hawkish_dovish_bias: -0.2,
  profile_md: 'profile',
};

const event: Event = {
  id: 'evt-1',
  title: 'Test',
  source: 'sample',
  raw_text: 'body',
  summary: 'summary',
  event_date: '2026-05-14',
  created_at: '2026-05-14T00:00:00Z',
};

describe('runPersonaAgent', () => {
  it('returns a complete Reaction when client returns a valid tool_use', async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'tool_use',
              name: 'submit_reaction',
              input: {
                rate_path_view: 'two cuts',
                balance_sheet_view: 'continue QT',
                risk_asset_view: 'neutral',
                key_concerns: ['inflation', 'wages'],
                hawkish_dovish_score: 0.1,
                confidence: 0.7,
                reasoning_md: 'paragraph one\n\nparagraph two',
              },
            },
          ],
          stop_reason: 'tool_use',
        }),
      },
    };

    const reaction = await runPersonaAgent(persona, event, {
      client: fakeClient as never,
      model: 'claude-test',
    });

    expect(reaction.persona_id).toBe('gs');
    expect(reaction.status).toBe('complete');
    expect(reaction.rate_path_view).toBe('two cuts');
    expect(reaction.key_concerns).toEqual(['inflation', 'wages']);
    expect(reaction.error).toBeNull();
  });

  it('returns failed Reaction when no tool_use block present', async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'plain text response' }],
          stop_reason: 'end_turn',
        }),
      },
    };

    const reaction = await runPersonaAgent(persona, event, {
      client: fakeClient as never,
      model: 'claude-test',
    });

    expect(reaction.status).toBe('failed');
    expect(reaction.error).toMatch(/tool_use/);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
npm test -- persona-agent
```

- [ ] **Step 3: Implement lib/persona-agent.ts**

```ts
// lib/persona-agent.ts
import type Anthropic from '@anthropic-ai/sdk';
import { buildPersonaPrompt } from '@/lib/prompts';
import { REACTION_TOOL, type ReactionToolInput, getAnthropicClient, getModel } from '@/lib/anthropic';
import type { Persona, Event, Reaction } from '@/lib/types';

export type PersonaAgentDeps = {
  client?: Anthropic;
  model?: string;
};

export async function runPersonaAgent(
  persona: Persona,
  event: Event,
  deps: PersonaAgentDeps = {},
): Promise<Reaction> {
  const client = deps.client ?? getAnthropicClient();
  const model = deps.model ?? getModel();

  const { system, user } = buildPersonaPrompt(persona, event);

  try {
    const resp = await client.messages.create({
      model,
      max_tokens: 1500,
      system,
      tools: [REACTION_TOOL as unknown as Anthropic.Tool],
      tool_choice: { type: 'tool', name: 'submit_reaction' },
      messages: [{ role: 'user', content: user }],
    });

    const block = resp.content.find((b) => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') {
      return failedReaction(persona.id, 'No tool_use block in response');
    }
    const input = block.input as ReactionToolInput;

    return {
      persona_id: persona.id,
      status: 'complete',
      rate_path_view: input.rate_path_view,
      balance_sheet_view: input.balance_sheet_view,
      risk_asset_view: input.risk_asset_view,
      key_concerns: input.key_concerns,
      hawkish_dovish_score: input.hawkish_dovish_score,
      confidence: input.confidence,
      reasoning_md: input.reasoning_md,
      error: null,
    };
  } catch (err: unknown) {
    return failedReaction(persona.id, errorMessage(err));
  }
}

function failedReaction(persona_id: string, error: string): Reaction {
  return {
    persona_id,
    status: 'failed',
    rate_path_view: '',
    balance_sheet_view: '',
    risk_asset_view: '',
    key_concerns: [],
    hawkish_dovish_score: 0,
    confidence: 0,
    reasoning_md: '',
    error,
  };
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
```

- [ ] **Step 4: Run, verify PASS**

```bash
npm test -- persona-agent
```

Expected: 2/2 pass.

- [ ] **Step 5: Real smoke test against Anthropic API**

```bash
# Make sure ANTHROPIC_API_KEY is set in .env.local
cat > /tmp/persona-smoke.mjs << 'EOF'
import 'dotenv/config';
import { runPersonaAgent } from './lib/persona-agent.ts';
import { PERSONAS } from './personas/index.ts';
import { getSampleEvent } from './lib/sample-events.ts';

const event = await getSampleEvent('sample-fomc-mar-2026');
const reaction = await runPersonaAgent(PERSONAS[0], event);
console.log(JSON.stringify(reaction, null, 2));
EOF
npm install -D dotenv
npx tsx -r dotenv/config /tmp/persona-smoke.mjs
```

Expected: prints a valid Reaction JSON for GS reacting to the FOMC sample. `status === 'complete'`. `reasoning_md` sounds Goldman-ish.

- [ ] **Step 6: Cleanup smoke artifact + commit**

```bash
rm /tmp/persona-smoke.mjs
git add lib/persona-agent.ts tests/persona-agent.test.ts package.json package-lock.json
git commit -m "feat(lib): persona-agent runs Anthropic call and parses Reaction tool_use"
```

---

## Chunk 5: Simulation runner + API routes

**Goal:** Orchestrate N persona-agent calls in parallel and expose them through Next.js API routes.

### Task 5.1: ID generator

**Files:**
- Create: `lib/id.ts`

- [ ] **Step 1: Implement**

```ts
// lib/id.ts
import { customAlphabet } from 'nanoid';

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
const newId = customAlphabet(alphabet, 10);

export function newSimId(): string {
  return `sim_${newId()}`;
}

export function newEventId(): string {
  return `evt_${newId()}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/id.ts
git commit -m "feat(lib): short id generator for sims and events"
```

### Task 5.2: Simulation runner

**Files:**
- Create: `lib/simulation-runner.ts`
- Create: `tests/simulation-runner.test.ts`

- [ ] **Step 1: Write failing test (with injected agent + storage)**

```ts
// tests/simulation-runner.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { runSimulation } from '@/lib/simulation-runner';
import { createStorage } from '@/lib/storage';
import type { Persona, Event, Reaction } from '@/lib/types';

const TEST_ROOT = path.join(process.cwd(), 'tmp-sim-test');

const personas: Persona[] = [
  {
    id: 'p1', name: 'P1', short_name: 'P1', type: 'primary_dealer',
    avatar_text: 'P1', hawkish_dovish_bias: 0, profile_md: 'p1',
  },
  {
    id: 'p2', name: 'P2', short_name: 'P2', type: 'primary_dealer',
    avatar_text: 'P2', hawkish_dovish_bias: 0, profile_md: 'p2',
  },
];

const event: Event = {
  id: 'evt-test', title: 'T', source: 'sample',
  raw_text: 'body', summary: 'sum', event_date: '2026-05-14',
  created_at: '2026-05-14T00:00:00Z',
};

const fakeReaction = (persona_id: string): Reaction => ({
  persona_id, status: 'complete',
  rate_path_view: 'view', balance_sheet_view: 'view', risk_asset_view: 'view',
  key_concerns: ['c'], hawkish_dovish_score: 0, confidence: 1,
  reasoning_md: 'r', error: null,
});

beforeEach(async () => {
  await rm(TEST_ROOT, { recursive: true, force: true });
  await mkdir(TEST_ROOT, { recursive: true });
});

describe('runSimulation', () => {
  it('writes sim.json and one reaction file per persona', async () => {
    const storage = createStorage({ backend: 'local', root: TEST_ROOT });
    const agent = vi.fn(async (p: Persona) => fakeReaction(p.id));

    const sim = await runSimulation({
      simId: 'sim_test',
      event,
      personas,
      storage,
      agent,
      concurrency: 2,
    });

    expect(sim.status).toBe('complete');
    expect(agent).toHaveBeenCalledTimes(2);

    const written = await storage.list('sims/sim_test/reactions/');
    expect(written).toHaveLength(2);

    const saved = await storage.getJson('sims/sim_test/sim.json');
    expect((saved as { status: string }).status).toBe('complete');
  });

  it('marks sim complete even if one persona fails', async () => {
    const storage = createStorage({ backend: 'local', root: TEST_ROOT });
    const agent = vi.fn(async (p: Persona) => {
      if (p.id === 'p2') {
        return { ...fakeReaction(p.id), status: 'failed' as const, error: 'boom' };
      }
      return fakeReaction(p.id);
    });

    const sim = await runSimulation({
      simId: 'sim_test', event, personas, storage, agent, concurrency: 2,
    });

    expect(sim.status).toBe('complete');
    const r2 = await storage.getJson<Reaction>('sims/sim_test/reactions/p2.json');
    expect(r2?.status).toBe('failed');
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
npm test -- simulation-runner
```

- [ ] **Step 3: Implement lib/simulation-runner.ts**

```ts
// lib/simulation-runner.ts
import pLimit from 'p-limit';
import type { Persona, Event, Reaction, Simulation } from '@/lib/types';
import type { Storage } from '@/lib/storage';
import { runPersonaAgent } from '@/lib/persona-agent';

export type Agent = (persona: Persona, event: Event) => Promise<Reaction>;

export type RunSimulationArgs = {
  simId: string;
  event: Event;
  personas: Persona[];
  storage: Storage;
  agent?: Agent;
  concurrency?: number;
};

export async function runSimulation(args: RunSimulationArgs): Promise<Simulation> {
  const {
    simId, event, personas, storage,
    agent = runPersonaAgent,
    concurrency = Number(process.env.MAX_PARALLEL_PERSONAS ?? 5),
  } = args;

  const created_at = new Date().toISOString();

  // Initial sim.json (status='running')
  let sim: Simulation = {
    id: simId,
    event_id: event.id,
    status: 'running',
    persona_ids: personas.map((p) => p.id),
    created_at,
    completed_at: null,
    error: null,
  };
  await storage.putJson(`sims/${simId}/sim.json`, sim);

  const limit = pLimit(concurrency);

  await Promise.all(
    personas.map((persona) =>
      limit(async () => {
        const reaction = await agent(persona, event);
        await storage.putJson(
          `sims/${simId}/reactions/${persona.id}.json`,
          reaction,
        );
      }),
    ),
  );

  sim = {
    ...sim,
    status: 'complete',
    completed_at: new Date().toISOString(),
  };
  await storage.putJson(`sims/${simId}/sim.json`, sim);

  return sim;
}
```

- [ ] **Step 4: Run, verify PASS**

```bash
npm test -- simulation-runner
```

Expected: 2/2 pass.

- [ ] **Step 5: Cleanup test root + commit**

```bash
rm -rf tmp-sim-test
git add lib/simulation-runner.ts tests/simulation-runner.test.ts
git commit -m "feat(lib): simulation-runner orchestrates parallel persona-agents with p-limit"
```

### Task 5.3: API route — POST /api/sim/run

**Files:**
- Create: `app/api/sim/run/route.ts`

- [ ] **Step 1: Implement**

```ts
// app/api/sim/run/route.ts
import { NextResponse } from 'next/server';
import type { Event } from '@/lib/types';
import { newSimId, newEventId } from '@/lib/id';
import { getDefaultStorage } from '@/lib/storage-default';
import { getSampleEvent } from '@/lib/sample-events';
import { PERSONAS } from '@/personas';
import { runSimulation } from '@/lib/simulation-runner';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = {
  event_id?: string;          // sample event id
  raw_text?: string;          // pasted event text
  title?: string;             // optional title for pasted
  event_date?: string;        // ISO date, optional
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const storage = getDefaultStorage();

  let event: Event;

  if (body.event_id) {
    const sample = await getSampleEvent(body.event_id);
    if (!sample) {
      return NextResponse.json({ error: 'Sample event not found' }, { status: 404 });
    }
    event = sample;
  } else if (body.raw_text) {
    const id = newEventId();
    event = {
      id,
      title: body.title?.trim() || 'Pasted event',
      source: 'pasted',
      raw_text: body.raw_text,
      summary: null,
      event_date: body.event_date ?? new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString(),
    };
    await storage.putJson(`events/${id}.json`, event);
  } else {
    return NextResponse.json(
      { error: 'Either event_id or raw_text is required' },
      { status: 400 },
    );
  }

  const simId = newSimId();
  // Fire-and-forget: don't block the request on the full fan-out.
  // Client polls /api/sim/[id] for completion.
  void runSimulation({ simId, event, personas: PERSONAS, storage });

  return NextResponse.json({ sim_id: simId, event_id: event.id });
}
```

- [ ] **Step 2: Smoke test**

```bash
npm run dev &
sleep 3
curl -X POST http://localhost:3000/api/sim/run \
  -H 'content-type: application/json' \
  -d '{"event_id":"sample-fomc-mar-2026"}'
# Expected: {"sim_id":"sim_xxx","event_id":"sample-fomc-mar-2026"}

# Wait ~30s, then check files
ls data/sims/sim_xxx/reactions/
# Expected: 5 .json files (one per persona)

# Stop server
kill %1
```

- [ ] **Step 3: Commit**

```bash
git add app/api/sim/run/route.ts
git commit -m "feat(api): POST /api/sim/run accepts event_id or raw_text, fires fan-out"
```

### Task 5.4: API route — GET /api/sim/[id]

**Files:**
- Create: `app/api/sim/[id]/route.ts`

- [ ] **Step 1: Implement**

```ts
// app/api/sim/[id]/route.ts
import { NextResponse } from 'next/server';
import type { Reaction, Simulation, Event, SimulationView } from '@/lib/types';
import { getDefaultStorage } from '@/lib/storage-default';
import { getSampleEvent } from '@/lib/sample-events';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const storage = getDefaultStorage();

  const sim = await storage.getJson<Simulation>(`sims/${id}/sim.json`);
  if (!sim) {
    return NextResponse.json({ error: 'Simulation not found' }, { status: 404 });
  }

  // Resolve event: try sample first, else from events/<id>.json
  let event = await getSampleEvent(sim.event_id);
  if (!event) {
    event = await storage.getJson<Event>(`events/${sim.event_id}.json`);
  }
  if (!event) {
    return NextResponse.json({ error: 'Event for simulation not found' }, { status: 500 });
  }

  const keys = await storage.list(`sims/${id}/reactions/`);
  const reactions = (
    await Promise.all(keys.map((k) => storage.getJson<Reaction>(k)))
  ).filter((r): r is Reaction => r !== null);

  const view: SimulationView = { ...sim, event, reactions };
  return NextResponse.json(view);
}
```

- [ ] **Step 2: Smoke test**

```bash
npm run dev &
sleep 3
# Use a sim_id from a previous run, OR run a new one:
SIM_ID=$(curl -s -X POST http://localhost:3000/api/sim/run \
  -H 'content-type: application/json' \
  -d '{"event_id":"sample-fomc-mar-2026"}' | jq -r .sim_id)
echo "sim id: $SIM_ID"
sleep 35
curl -s "http://localhost:3000/api/sim/$SIM_ID" | jq '.status, .reactions | length'
# Expected: "complete" and 5
kill %1
```

- [ ] **Step 3: Commit**

```bash
git add app/api/sim/\[id\]/route.ts
git commit -m "feat(api): GET /api/sim/[id] returns merged sim + reactions + event"
```

### Task 5.5: API routes — personas + sample events

**Files:**
- Create: `app/api/personas/route.ts`
- Create: `app/api/events/samples/route.ts`

- [ ] **Step 1: Implement personas route**

```ts
// app/api/personas/route.ts
import { NextResponse } from 'next/server';
import { PERSONAS } from '@/personas';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(PERSONAS);
}
```

- [ ] **Step 2: Implement samples route**

```ts
// app/api/events/samples/route.ts
import { NextResponse } from 'next/server';
import { loadSampleEvents } from '@/lib/sample-events';

export const runtime = 'nodejs';

export async function GET() {
  const events = await loadSampleEvents();
  return NextResponse.json(events);
}
```

- [ ] **Step 3: Smoke test**

```bash
npm run dev &
sleep 3
curl -s http://localhost:3000/api/personas | jq 'length'
# Expected: 5
curl -s http://localhost:3000/api/events/samples | jq 'length'
# Expected: 3
kill %1
```

- [ ] **Step 4: Commit**

```bash
git add app/api/personas/route.ts app/api/events/samples/route.ts
git commit -m "feat(api): GET /api/personas and GET /api/events/samples"
```

---

## Chunk 6: Results page UI

**Goal:** The simulation page that handles both running and complete states, with the comparative table and expandable rows. This is the heart of the demo.

### Task 6.1: Disclaimer banner component

**Files:**
- Create: `components/disclaimer-banner.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/disclaimer-banner.tsx
export function DisclaimerBanner() {
  return (
    <div className="bg-amber-50 border-l-4 border-amber-400 px-3 py-2 text-xs text-amber-800">
      <span className="font-medium">⚠ Simulated views</span> — not actual dealer commentary.
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/disclaimer-banner.tsx
git commit -m "feat(ui): disclaimer banner component"
```

### Task 6.2: Persona row expanded content

**Files:**
- Create: `components/persona-row-expanded.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/persona-row-expanded.tsx
import { Badge } from '@/components/ui/badge';
import type { Reaction, Persona } from '@/lib/types';

type Props = { reaction: Reaction; persona: Persona };

export function PersonaRowExpanded({ reaction, persona }: Props) {
  if (reaction.status === 'failed') {
    return (
      <div className="px-4 py-3 bg-muted/30">
        <p className="text-sm text-muted-foreground">
          Reaction failed: {reaction.error ?? 'unknown error'}
        </p>
      </div>
    );
  }
  return (
    <div className="px-4 py-3 bg-muted/30 space-y-2">
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">{persona.name} reasoning</span>
        <Badge variant="secondary" className="text-[10px]">simulated</Badge>
      </div>
      <div className="prose prose-sm max-w-none whitespace-pre-line">
        {reaction.reasoning_md}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/persona-row-expanded.tsx
git commit -m "feat(ui): persona row expanded content with simulated chip"
```

### Task 6.3: Persona table component

**Files:**
- Create: `components/persona-table.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/persona-table.tsx
'use client';
import { useState, useMemo } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PersonaRowExpanded } from '@/components/persona-row-expanded';
import type { Reaction, Persona } from '@/lib/types';

type Props = {
  reactions: Reaction[];
  personas: Persona[];
  sortBy?: 'persona' | 'hd_score';
};

export function PersonaTable({ reactions, personas, sortBy = 'persona' }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const personaById = useMemo(
    () => Object.fromEntries(personas.map((p) => [p.id, p])),
    [personas],
  );
  const sorted = useMemo(() => {
    const arr = [...reactions];
    if (sortBy === 'hd_score') {
      arr.sort((a, b) => a.hawkish_dovish_score - b.hawkish_dovish_score);
    }
    return arr;
  }, [reactions, sortBy]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Persona</TableHead>
          <TableHead>Rate path</TableHead>
          <TableHead>Balance sheet</TableHead>
          <TableHead>Risk assets</TableHead>
          <TableHead className="text-right">H/D</TableHead>
          <TableHead className="text-right">Conf</TableHead>
          <TableHead>Top concern</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((r) => {
          const p = personaById[r.persona_id];
          if (!p) return null;
          const isOpen = expanded === r.persona_id;
          const isFailed = r.status === 'failed';
          return (
            <>
              <TableRow
                key={r.persona_id}
                className="cursor-pointer hover:bg-muted/40"
                onClick={() => setExpanded(isOpen ? null : r.persona_id)}
              >
                <TableCell className="font-medium">
                  {p.short_name}
                  {isFailed && (
                    <Badge variant="destructive" className="ml-2 text-[10px]">
                      failed
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{isFailed ? '—' : r.rate_path_view}</TableCell>
                <TableCell>{isFailed ? '—' : r.balance_sheet_view}</TableCell>
                <TableCell>{isFailed ? '—' : r.risk_asset_view}</TableCell>
                <TableCell className="text-right">
                  {isFailed ? '—' : r.hawkish_dovish_score.toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  {isFailed ? '—' : r.confidence.toFixed(2)}
                </TableCell>
                <TableCell>
                  {isFailed ? '—' : (r.key_concerns[0] ?? '—')}
                </TableCell>
              </TableRow>
              {isOpen && (
                <TableRow key={`${r.persona_id}-expanded`}>
                  <TableCell colSpan={7} className="p-0">
                    <PersonaRowExpanded reaction={r} persona={p} />
                  </TableCell>
                </TableRow>
              )}
            </>
          );
        })}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/persona-table.tsx
git commit -m "feat(ui): comparative persona table with row expansion"
```

### Task 6.4: Sim page (running + complete states)

**Files:**
- Create: `app/sim/[id]/page.tsx`
- Create: `app/sim/[id]/sim-view.tsx` (client component)

- [ ] **Step 1: Server page (passes id)**

```tsx
// app/sim/[id]/page.tsx
import { SimView } from './sim-view';

type Props = { params: Promise<{ id: string }> };

export default async function SimPage({ params }: Props) {
  const { id } = await params;
  return <SimView id={id} />;
}
```

- [ ] **Step 2: Client view with polling**

```tsx
// app/sim/[id]/sim-view.tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { DisclaimerBanner } from '@/components/disclaimer-banner';
import { PersonaTable } from '@/components/persona-table';
import type { SimulationView, Persona } from '@/lib/types';

const POLL_MS = 1500;

export function SimView({ id }: { id: string }) {
  const [data, setData] = useState<SimulationView | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [sortBy, setSortBy] = useState<'persona' | 'hd_score'>('persona');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const tick = async () => {
      try {
        const [simRes, persRes] = await Promise.all([
          fetch(`/api/sim/${id}`, { cache: 'no-store' }),
          fetch('/api/personas', { cache: 'no-store' }),
        ]);
        if (!simRes.ok) {
          setError(`Failed to load simulation (${simRes.status})`);
          return;
        }
        const sim = (await simRes.json()) as SimulationView;
        const ps = (await persRes.json()) as Persona[];
        if (cancelled) return;
        setData(sim);
        setPersonas(ps);
        if (sim.status === 'running' || sim.status === 'queued') {
          timer = setTimeout(tick, POLL_MS);
        }
      } catch (e) {
        setError(String(e));
      }
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id]);

  if (error) {
    return <div className="p-8 text-red-600">{error}</div>;
  }
  if (!data) {
    return (
      <div className="max-w-5xl mx-auto p-8 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const isRunning = data.status === 'running' || data.status === 'queued';
  const completedCount = data.reactions.length;
  const totalCount = data.persona_ids.length;

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-4">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Back
      </Link>
      <h1 className="text-2xl font-semibold">{data.event.title}</h1>
      <p className="text-sm text-muted-foreground">{data.event.event_date}</p>
      {data.event.summary && (
        <p className="text-sm">{data.event.summary}</p>
      )}
      <DisclaimerBanner />

      {isRunning ? (
        <Card>
          <CardContent className="p-6 space-y-3">
            <p className="text-sm">
              Sounding running… {completedCount} of {totalCount} personas complete
            </p>
            <div className="flex gap-2 flex-wrap">
              {personas.map((p) => {
                const done = data.reactions.find((r) => r.persona_id === p.id);
                return (
                  <span
                    key={p.id}
                    className={`px-2 py-1 rounded text-xs border ${
                      done ? 'bg-green-50 border-green-300' : 'bg-muted'
                    }`}
                  >
                    {done ? '✓ ' : '⟳ '}{p.short_name}
                  </span>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setSortBy((s) => (s === 'persona' ? 'hd_score' : 'persona'))
              }
            >
              Sort by: {sortBy === 'persona' ? 'persona' : 'hawkish ↔ dovish'}
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <PersonaTable
                reactions={data.reactions}
                personas={personas}
                sortBy={sortBy}
              />
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Smoke test in browser**

```bash
npm run dev
```

Open `http://localhost:3000/sim/<a-real-sim-id>` (use one from Chunk 5 smoke test). Verify: running state shows progress chips, then snaps to table. Click row → expands. Click sort → reorders.

- [ ] **Step 4: Commit**

```bash
git add app/sim/
git commit -m "feat(ui): sim page with polling, running state, and complete-state table"
```

---

## Chunk 7: Landing page + sample events UI

**Goal:** The landing page where the demo starts. Sample event cards do most of the work.

### Task 7.1: Sample event card component

**Files:**
- Create: `components/sample-event-card.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/sample-event-card.tsx
'use client';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import type { Event } from '@/lib/types';

export function SampleEventCard({ event }: { event: Event }) {
  const router = useRouter();
  const onClick = async () => {
    const res = await fetch('/api/sim/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event_id: event.id }),
    });
    const { sim_id } = (await res.json()) as { sim_id: string };
    router.push(`/sim/${sim_id}`);
  };
  return (
    <Card
      onClick={onClick}
      className="cursor-pointer hover:shadow-md transition-shadow"
    >
      <CardContent className="p-4 space-y-1">
        <p className="font-medium text-sm">{event.title}</p>
        <p className="text-xs text-muted-foreground">{event.event_date}</p>
        {event.summary && (
          <p className="text-xs mt-2 line-clamp-2">{event.summary}</p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/sample-event-card.tsx
git commit -m "feat(ui): sample event card kicks off a sim and routes to /sim/[id]"
```

### Task 7.2: Landing page

**Files:**
- Modify: `app/page.tsx`
- Create: `app/landing.tsx` (client component for the form)

- [ ] **Step 1: Server page loads samples**

```tsx
// app/page.tsx
import { loadSampleEvents } from '@/lib/sample-events';
import { Landing } from './landing';

export default async function Home() {
  const samples = await loadSampleEvents();
  return <Landing samples={samples} />;
}
```

- [ ] **Step 2: Client landing component**

```tsx
// app/landing.tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { SampleEventCard } from '@/components/sample-event-card';
import type { Event } from '@/lib/types';

export function Landing({ samples }: { samples: Event[] }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    const res = await fetch('/api/sim/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ raw_text: text, title }),
    });
    const { sim_id } = (await res.json()) as { sim_id: string };
    router.push(`/sim/${sim_id}`);
  };

  return (
    <main className="max-w-3xl mx-auto p-8 space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">MarketSounding</h1>
        <Link href="/about" className="text-sm hover:underline">About</Link>
      </header>

      <section className="space-y-3">
        <p className="text-muted-foreground">
          A market-soundings sandbox for the Markets desk.
        </p>
        <input
          type="text"
          placeholder="Title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
        />
        <Textarea
          placeholder="Paste a market event… (FOMC statement, press release, news headline)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
        />
        <Button onClick={submit} disabled={busy || !text.trim()}>
          {busy ? 'Starting…' : 'Run sounding →'}
        </Button>
      </section>

      <Separator />

      <section className="space-y-3">
        <p className="text-sm font-medium">Or try a sample</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {samples.map((e) => (
            <SampleEventCard key={e.id} event={e} />
          ))}
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Smoke test**

Open `http://localhost:3000`. Click each sample card → routes to a sim that completes. Paste arbitrary text + click submit → routes to a sim.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx app/landing.tsx
git commit -m "feat(ui): landing page with paste form and 3 sample event cards"
```

---

## Chunk 8: Hawkish/dovish strip + About page

**Goal:** Tremor-based visualization above the table, plus the About page that fields judge questions.

### Task 8.1: Hawkish/dovish strip

**Files:**
- Create: `components/hawkish-dovish-strip.tsx`
- Modify: `app/sim/[id]/sim-view.tsx` (insert above table)

- [ ] **Step 1: Implement strip**

```tsx
// components/hawkish-dovish-strip.tsx
import type { Reaction, Persona } from '@/lib/types';

type Props = { reactions: Reaction[]; personas: Persona[] };

// Convert -1..+1 score to 0..100% position
const toPct = (s: number) => ((s + 1) / 2) * 100;

export function HawkishDovishStrip({ reactions, personas }: Props) {
  const personaById = Object.fromEntries(personas.map((p) => [p.id, p]));
  const visible = reactions.filter((r) => r.status === 'complete');

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>← Dovish</span>
        <span>Hawkish →</span>
      </div>
      <div className="relative h-10 rounded bg-gradient-to-r from-blue-100 via-gray-100 to-red-100 border">
        {visible.map((r) => {
          const p = personaById[r.persona_id];
          if (!p) return null;
          return (
            <div
              key={r.persona_id}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-white border text-[10px] font-medium shadow-sm"
              style={{ left: `${toPct(r.hawkish_dovish_score)}%` }}
              title={`${p.name}: ${r.hawkish_dovish_score.toFixed(2)}`}
            >
              {p.short_name}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

(Note: this is plain Tailwind, not Tremor's `Tracker`. Tremor's Tracker is bar-segment based and harder to bend to "labeled dots on a continuous line." Plain CSS gives a cleaner result faster.)

- [ ] **Step 2: Insert above table in sim-view.tsx**

In `app/sim/[id]/sim-view.tsx`, after the closing `<DisclaimerBanner />`, in the `else` (complete) branch, insert before the sort button:

```tsx
import { HawkishDovishStrip } from '@/components/hawkish-dovish-strip';

// inside the JSX, complete-state branch, BEFORE the flex justify-end div:
<HawkishDovishStrip reactions={data.reactions} personas={personas} />
```

- [ ] **Step 3: Smoke test**

Open a completed sim. Verify dots appear on the strip, hover tooltips show name + score, dots are roughly distributed.

- [ ] **Step 4: Commit**

```bash
git add components/hawkish-dovish-strip.tsx app/sim/\[id\]/sim-view.tsx
git commit -m "feat(ui): hawkish/dovish strip above the comparative table"
```

### Task 8.2: About page

**Files:**
- Create: `app/about/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// app/about/page.tsx
import Link from 'next/link';

export default function About() {
  return (
    <main className="max-w-3xl mx-auto p-8 prose prose-sm">
      <Link href="/" className="text-sm text-muted-foreground hover:underline no-underline">
        ← Back
      </Link>
      <h1>About MarketSounding</h1>
      <p>
        MarketSounding is a decision-support sandbox for NY Federal Reserve Markets
        Group desk staff. It simulates how primary dealer personas would react to a
        market event, returning a comparative brief in seconds. The output is a
        thinking tool — not a substitute for actual dealer commentary or survey
        responses.
      </p>

      <h2>How it works</h2>
      <ol>
        <li>You paste a market event (FOMC statement, CPI release, news headline) or pick a sample.</li>
        <li>The app fans the event out to 5 simulated dealer personas in parallel — each grounded in a hand-curated profile.</li>
        <li>Each persona returns a structured reaction: rate path view, balance sheet view, risk-asset positioning, key concerns, hawkish/dovish stance, and 2-3 paragraphs of in-voice reasoning.</li>
        <li>You see them all on one comparative page, color-coded and sortable.</li>
      </ol>

      <h2>What this is NOT</h2>
      <ul>
        <li>Not a feed of actual dealer research</li>
        <li>Not a substitute for the real Survey of Primary Dealers (SPD) or Survey of Market Participants (SMD)</li>
        <li>Not a forecasting model — it surfaces plausible perspectives, not predictions</li>
      </ul>

      <h2>Roadmap</h2>
      <ul>
        <li><strong>Phase 2:</strong> Multi-turn roundtable transcript using AWS AgentCore. Counterfactual scenario branching. Buy-side personas (PIMCO, BlackRock, etc.).</li>
        <li><strong>Phase 3:</strong> FOMC voting member personas. Pre-survey anticipation workflow.</li>
        <li><strong>Phase 4:</strong> Survey response augmentation. Fed-internal data integration (governance gated).</li>
      </ul>

      <h2>Stack</h2>
      <ul>
        <li>Next.js 15 + TypeScript on AWS Amplify</li>
        <li>Anthropic Claude (migrating to Amazon Bedrock for production)</li>
        <li>S3 for persistence (DynamoDB in production)</li>
      </ul>

      <h2>Inspiration</h2>
      <p>
        Architecturally inspired by{' '}
        <a href="https://github.com/yangkuoshih/MiroFish" target="_blank" rel="noreferrer">
          MiroFish
        </a>
        , a multi-agent simulation engine for narrative prediction.
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Smoke test**

Open `http://localhost:3000/about`. Verify all sections render, the back link works.

- [ ] **Step 3: Commit**

```bash
git add app/about/
git commit -m "feat(ui): about page with how-it-works, scope, roadmap, stack"
```

### Task 8.3: Root layout polish

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update layout metadata**

```tsx
// app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MarketSounding',
  description: 'A market-soundings sandbox for the Markets desk.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/layout.tsx
git commit -m "chore(ui): set MarketSounding metadata in root layout"
```

---

## Chunk 9: Polish, fallback demo, deploy, demo prep

**Goal:** A bullet-proof demo. Every failure mode has a fallback. The pitch is rehearsed.

### Task 9.1: Fallback demo result

**Files:**
- Create: `data/sample-events/_fallback-sim.json`
- Create: `app/sim/_fallback/page.tsx`

- [ ] **Step 1: Generate the fallback**

```bash
# Run a real sim against FOMC sample, then capture the result
SIM_ID=$(curl -s -X POST http://localhost:3000/api/sim/run \
  -H 'content-type: application/json' \
  -d '{"event_id":"sample-fomc-mar-2026"}' | jq -r .sim_id)
sleep 35
curl -s "http://localhost:3000/api/sim/$SIM_ID" > data/sample-events/_fallback-sim.json
# Inspect — it should contain status='complete', 5 reactions, full event
jq '.status, .reactions | length' data/sample-events/_fallback-sim.json
# Expected: "complete" and 5
```

- [ ] **Step 2: Create the fallback route**

```tsx
// app/sim/_fallback/page.tsx
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { SimulationView } from '@/lib/types';
import { FallbackView } from './fallback-view';

export default async function FallbackPage() {
  const raw = await readFile(
    path.join(process.cwd(), 'data', 'sample-events', '_fallback-sim.json'),
    'utf-8',
  );
  const data = JSON.parse(raw) as SimulationView;
  return <FallbackView data={data} />;
}
```

```tsx
// app/sim/_fallback/fallback-view.tsx
'use client';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { DisclaimerBanner } from '@/components/disclaimer-banner';
import { PersonaTable } from '@/components/persona-table';
import { HawkishDovishStrip } from '@/components/hawkish-dovish-strip';
import type { SimulationView, Persona } from '@/lib/types';
import { PERSONAS } from '@/personas';

export function FallbackView({ data }: { data: SimulationView }) {
  const personas: Persona[] = PERSONAS;
  return (
    <main className="max-w-5xl mx-auto p-6 space-y-4">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Back
      </Link>
      <h1 className="text-2xl font-semibold">{data.event.title}</h1>
      <p className="text-sm text-muted-foreground">{data.event.event_date}</p>
      {data.event.summary && <p className="text-sm">{data.event.summary}</p>}
      <DisclaimerBanner />
      <HawkishDovishStrip reactions={data.reactions} personas={personas} />
      <Card>
        <CardContent className="p-0">
          <PersonaTable reactions={data.reactions} personas={personas} />
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 3: Smoke test**

```bash
npm run dev
```

Open `http://localhost:3000/sim/_fallback`. Verify the page renders the cached sim instantly, no LLM call.

- [ ] **Step 4: Commit**

```bash
git add data/sample-events/_fallback-sim.json app/sim/_fallback/
git commit -m "feat(demo): /sim/_fallback serves a pre-baked sim, demo-safe under API outage"
```

### Task 9.2: Recent simulations list (optional polish)

**Files:**
- Modify: `app/page.tsx` to also load recent sims
- Modify: `app/landing.tsx` to render a list

- [ ] **Step 1: Add a list-recent-sims helper**

```ts
// lib/recent-sims.ts
import type { Simulation, Event } from '@/lib/types';
import { getDefaultStorage } from '@/lib/storage-default';
import { getSampleEvent } from '@/lib/sample-events';

export type RecentSim = {
  id: string;
  event_title: string;
  created_at: string;
};

export async function loadRecentSims(limit = 5): Promise<RecentSim[]> {
  const storage = getDefaultStorage();
  const keys = await storage.list('sims/');
  // Local backend lists files only at top level; we want sims/<id>/sim.json.
  // Workaround: list each sim's sim.json by scanning sub-prefixes.
  // For simplicity, on local FS we re-scan; on S3 list returns nested keys.
  const simKeys = keys.filter((k) => k.endsWith('/sim.json'));
  const sims = (
    await Promise.all(simKeys.map((k) => storage.getJson<Simulation>(k)))
  ).filter((s): s is Simulation => s !== null);

  const out: RecentSim[] = [];
  for (const s of sims) {
    let title = 'Pasted event';
    const sample = await getSampleEvent(s.event_id);
    if (sample) title = sample.title;
    else {
      const ev = await storage.getJson<Event>(`events/${s.event_id}.json`);
      if (ev) title = ev.title;
    }
    out.push({ id: s.id, event_title: title, created_at: s.created_at });
  }
  out.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return out.slice(0, limit);
}
```

(Note: the local-backend `list` only returns files in the directly-listed prefix. For `loadRecentSims` to work on local FS, you may need to extend the local `list` impl to recurse one level, OR call `list` on each sim subdir. For hackathon: an acceptable shortcut is to add a `listDirs(prefix)` helper to storage that returns sub-directory names, and for S3 use the existing list since S3 returns nested paths flat.)

- [ ] **Step 2: Extend storage with listDirs (only used on local)**

In `lib/storage.ts`, add to the `Storage` type:

```ts
listDirs(prefix: string): Promise<string[]>;
```

Local impl:
```ts
async listDirs(prefix) {
  const abs_prefix = abs(prefix);
  try {
    const entries = await readdir(abs_prefix);
    const out: string[] = [];
    for (const entry of entries) {
      const full = path.join(abs_prefix, entry);
      const s = await stat(full);
      if (s.isDirectory()) out.push(path.posix.join(prefix.replace(/\\/g, '/'), entry));
    }
    return out;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}
```

S3 impl: re-use `list` and reduce to unique parent prefixes. Or just stub as `return []` for hackathon (local only matters for dev recent list; production demo will use `_fallback`).

Update `loadRecentSims` to use `listDirs('sims/')` to find sim ids, then `getJson` each.

- [ ] **Step 3: Render in landing**

In `app/page.tsx`:
```tsx
import { loadRecentSims } from '@/lib/recent-sims';
// ...
const recent = await loadRecentSims();
return <Landing samples={samples} recent={recent} />;
```

In `app/landing.tsx`, accept `recent` prop and render a `<section>` with `<Link>` to each.

- [ ] **Step 4: Commit (or skip if behind schedule)**

```bash
git add lib/recent-sims.ts lib/storage.ts app/page.tsx app/landing.tsx
git commit -m "feat(ui): recent simulations list on landing page"
```

### Task 9.3: README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write a hackathon-grade README**

```markdown
# MarketSounding

> A market-soundings sandbox for the Markets desk.

MarketSounding simulates how primary dealer personas would react to a market event,
returning a comparative reaction brief on a single page. Built as a 48-hour hackathon
demo, inspired by [MiroFish](https://github.com/yangkuoshih/MiroFish).

## Quick start

```bash
cp .env.example .env.local
# Edit .env.local and set ANTHROPIC_API_KEY
npm install
npm run dev
# Open http://localhost:3000
```

## Try it

- Click any sample event card on the landing page
- Wait ~25-30 seconds while 5 personas respond in parallel
- Click any row in the results table to see that persona's reasoning
- Visit `/sim/_fallback` for a pre-baked demo result (no LLM call)

## Stack

Next.js 15 · TypeScript · Tailwind · shadcn/ui · Tremor · Anthropic Claude · AWS S3 · AWS Amplify

## Project docs

- `docs/specs/2026-05-14-marketsounding-hackathon-design.md` — design spec
- `docs/specs/2026-05-14-marketsounding-production-roadmap.md` — post-hackathon roadmap
- `docs/plans/2026-05-14-marketsounding-hackathon-build.md` — implementation plan
- `docs/inspiration/` — MiroFish reference files

## Disclaimer

Output is *simulated* persona views grounded in hand-authored profiles. It is a thinking
tool, not actual dealer commentary or a substitute for the SMD/SPD survey processes.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: hackathon README with quickstart and demo notes"
```

### Task 9.4: Final Amplify deploy + smoke

- [ ] **Step 1: Set Amplify env vars**

In AWS Console → Amplify → App settings → Environment variables, add:
- `ANTHROPIC_API_KEY` (your Claude key)
- `ANTHROPIC_MODEL` = `claude-sonnet-4-5`
- `STORAGE_BACKEND` = `s3`
- `S3_BUCKET` = your bucket name (create one in S3 first)
- `AWS_REGION` = `us-east-1`

- [ ] **Step 2: Create the S3 bucket + IAM role**

```bash
aws s3 mb s3://marketsounding-data --region us-east-1
```

In Amplify, the build IAM role needs `s3:PutObject`, `s3:GetObject`, `s3:ListBucket` on `marketsounding-data` and `marketsounding-data/*`. Add an inline policy.

- [ ] **Step 3: Push and verify deploy**

```bash
git push origin main
```

Watch Amplify build log. Expected: build succeeds in 3-5 min.

- [ ] **Step 4: End-to-end smoke from clean browser**

Open the Amplify URL in an incognito window:
1. Click an FOMC sample card → routes to /sim/...
2. Wait ~30s — sim completes
3. Click GS row → expands with reasoning
4. Sort by hawkish/dovish — table reorders
5. Visit /sim/_fallback — pre-baked sim renders instantly
6. Visit /about — page renders

If anything broken: fix, push, retry.

- [ ] **Step 5: Commit any final fixes**

### Task 9.5: Demo prep

- [ ] **Step 1: Write the pitch script**

Create `docs/demo-script.md` with the 90-second pitch from spec §9. Print it.

- [ ] **Step 2: Pre-record backup demo video**

Use macOS screen recording (Cmd-Shift-5). Record a clean 60-second run of: landing → sample click → loading → results → row expand → sort → about. Save as `docs/demo-backup.mp4`. Don't commit (large binary), but keep it on the demo machine.

- [ ] **Step 3: Rehearse 3x**

Time yourself. Make sure pitch lands at 90 seconds with 30 seconds of buffer for questions.

- [ ] **Step 4: Pre-warm the API before pitching**

Right before going on stage, run one sim from the live URL to warm the Lambda + Anthropic connection. Keep the result tab open as a backup.

---

## Cut order if behind schedule

If you fall behind, cut in this order (re-order tasks accordingly):

1. **Task 9.2** (recent simulations list) — bonus polish, not in pitch
2. **Task 8.1** (hawkish/dovish strip) — table alone is still demo-able
3. **Task 8.2** (About page) — can answer judge questions verbally
4. **Task 8.3** (loading animation polish) — basic polling chips already exist

Never cut: deploy (Task 9.4), fallback (Task 9.1), README quickstart (Task 9.3).

---

## Verification before declaring "done"

Run this checklist before the pitch:

- [ ] `npm test` — all tests pass
- [ ] `npx tsc --noEmit` — no TypeScript errors
- [ ] `npm run build` — production build succeeds
- [ ] Live Amplify URL works in incognito browser
- [ ] All 3 sample events run end-to-end
- [ ] `/sim/_fallback` works with no LLM call
- [ ] Disclaimer banner visible on every results page
- [ ] At least one full pitch rehearsal under 90 seconds
- [ ] Backup demo video on demo machine
