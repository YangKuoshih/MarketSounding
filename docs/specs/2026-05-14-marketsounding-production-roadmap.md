---
name: MarketSounding — Production Roadmap
description: Post-hackathon production design and phased roadmap for MarketSounding
status: design-reference (not for hackathon build)
date: 2026-05-14
author: Tony Yang
---

# MarketSounding — Production Roadmap

This document captures the production-grade design that emerged from brainstorming. **It is NOT what gets built in the 48-hour hackathon** — see `2026-05-14-marketsounding-hackathon-design.md` for that. This doc preserves the longer-term plan so it isn't lost.

The hackathon edition is essentially **Phase 1 with scope cuts to fit 48 hours**. Everything below describes how MarketSounding evolves once the demo proves the idea.

---

## 1. Production stack (post-hackathon)

| Layer | Hackathon | Production |
|---|---|---|
| Frontend + API | Next.js 15 (TS) | Next.js 15 (TS) — same |
| LLM | Anthropic API direct | **Amazon Bedrock** (Claude Sonnet 4.5 via Converse API) |
| RAG / persona memory | Profile-only, no RAG | **Bedrock Knowledge Bases** (Phase 1.5) → **AgentCore Memory** added in Phase 2 |
| Storage | JSON files | **DynamoDB** (events, simulations, reactions, personas) |
| File storage | Local | **S3** (raw PDFs, scraped persona corpus) |
| Hosting | AWS Amplify | AWS Amplify (or ECS/Fargate for VPC isolation) |
| Auth | None | **Amazon Cognito** |
| Secrets | `.env.local` | **AWS Secrets Manager** |
| Observability | Console + Amplify logs | **CloudWatch** + AgentCore Observability when available |

**Why this evolution path:**
- Anthropic-direct → Bedrock buys data residency, no-training guarantees, GovCloud option, single-vendor billing — material for any Fed-context production deployment
- JSON files → DynamoDB buys multi-instance scaling, atomic updates, queryability
- No-auth → Cognito buys access control, audit trails, identity for collaboration features
- No-RAG → Bedrock KB buys per-persona grounding without third-party SaaS dependency

---

## 2. Phased feature roadmap

### Phase 1 (Hackathon → Polish, ~2 weeks total)

What ships in the hackathon, then hardened over 1-2 weeks:
- 5-8 primary dealer personas
- Live event reaction simulation (paste text)
- Comparative table view + hawkish/dovish strip
- Sample events
- Disclaimers, basic citations

**Phase 1.5 (post-hackathon migration, ~1 week):**
- Migrate Anthropic → Bedrock
- Migrate JSON files → DynamoDB
- Add Bedrock Knowledge Bases for persona corpus
- Build the persona seeding script (scrape curated public sources → S3 → KB)
- Add Cognito with placeholder auth UI

### Phase 2 (~6-8 weeks after Phase 1 ships)

- **Roundtable transcript** — multi-turn agent dialogue using AgentCore Runtime + AgentCore Memory
- **Counterfactual / scenario branching** — "what if CPI prints 0.4% vs 0.2%"
- **Buy-side personas** — PIMCO, BlackRock, Bridgewater, Vanguard (~5 firms)
- **Cards view** + **Sentiment dashboard** as separate tabs alongside the table
- **PDF upload** + better event ingest (URL fetch optional)
- **Cognito auth turned on** — real users, sessions, basic permissions
- **Export to briefing PDF** — produce a printable comparative brief
- **Streaming output** — reactions appear as personas complete, not via polling
- **Scheduled corpus refresh** — cron-style monthly KB re-ingest
- **In-app profile editor** — edit persona profiles without redeploying

### Phase 3

- **FOMC voting member personas** — Powell, Williams, Waller, etc. Distinct prompt scaffolding (deciders vs. commentators), distinct output schema, more sensitive grounding requirements
- **Pre-survey anticipation workflow** — structured survey-question input, answer formatting matched to SMD/SPD
- **Cross-simulation comparison views** — "how did GS shift from March FOMC to April CPI?"
- **Live news feed (selective)** — Fed wire, BLS, BEA — public official sources only

### Phase 4 / Future

- **Survey response augmentation** — ingest actual survey responses, fill gaps from non-responders, stress-test consensus by comparing real vs simulated
- **Fed-internal data integration** — research feeds, prior survey responses (governance gated)
- **Multilingual buy-side corpus** — non-English research for global asset managers
- **Fine-tuned persona models** — only if RAG quality plateaus

---

## 3. Production data model (post-Phase 1.5)

```ts
// DynamoDB tables (single-table or multi-table — TBD)
table personas {
  id, name, short_name, type, profile_md, kb_id,
  hawkish_dovish_bias, active, updated_at
}

table events {
  id, title, source, raw_text, summary, event_date, created_at
}

table simulations {
  id, event_id, status, persona_ids (array),
  created_at, completed_at, error
}

table reactions {
  id, simulation_id, persona_id, status,
  rate_path_view, balance_sheet_view, risk_asset_view,
  key_concerns (array), hawkish_dovish_score, confidence, surprise_score,
  reasoning_md, citations (array of KB chunk IDs), created_at
}
```

Adds vs. hackathon: per-reaction citations referencing real KB chunks, separate `reactions` table for queryability, `kb_id` on personas pointing to per-persona Bedrock KB namespace.

---

## 4. Persona seeding (Phase 1.5)

**Hackathon:** profiles are TS files in `personas/index.ts`, written by hand.

**Production:** profiles still hand-written in markdown, BUT augmented with a per-persona corpus retrieved at simulation time via Bedrock KB.

### Sources, in priority order

| Tier | Source | Per-persona volume | Update cadence |
|---|---|---|---|
| 1. Public statements | Speeches, conferences, podcasts (transcribed) | 5-15 docs | Monthly |
| 2. Free research | Public "what we're watching" notes, GS Insights, etc. | 5-20 docs | Monthly |
| 3. News quotes | Bloomberg/Reuters/CNBC excerpts (with citation) | 10-30 excerpts | Weekly |
| 4. Filings | Annual reports, public dealer survey summaries | 1-3 docs | Quarterly |

**Never ingest:** paywalled/proprietary research, Fed-internal data (governance gated), personal social media.

### Seeding script (`scripts/seed-personas.ts`)

YAML config of URLs per persona → fetch → extract clean text → tag with metadata (`persona_id`, `source_url`, `fetched_at`, `source_type`) → upload to S3 → trigger Bedrock KB ingestion → update `personas.kb_last_updated`.

Run modes:
- `npm run seed:personas` — full re-ingest
- `npm run seed:personas -- --persona gs` — single persona
- `npm run seed:personas -- --dry-run` — fetch + report, no upload

Cadence: manual + monthly initially; cron-scheduled in Phase 2.

---

## 5. Production prompt template (with RAG)

```
SYSTEM:
You are simulating the public investment view of {persona.name},
a {persona.type}. Speak in their established house voice.

PERSONA PROFILE:
{persona.profile_md}

RECENT MATERIAL (retrieved from KB):
{top-K chunks for this persona, ranked by relevance to the event}
For each chunk, include the source_url so you can cite it.

USER:
EVENT (occurring {event_date}):
{event.summary}
{event.raw_text}

Produce a structured JSON response matching the reaction schema:
- rate_path_view (1 sentence)
- balance_sheet_view (1 sentence)
- risk_asset_view (1 sentence)
- key_concerns (array of 1-3 strings)
- hawkish_dovish_score (-1 to +1)
- confidence (0 to 1)
- surprise_score (0 to 1)
- reasoning_md (2-3 paragraphs in their voice)
- citations (array of source_urls actually used)

Be honest about uncertainty. If the event is outside this persona's
normal coverage, use low confidence rather than inventing detail.
Do not contradict the persona's documented house view without
explicitly noting the change.
```

---

## 6. Trust & honesty mechanisms (production)

Without these, this whole project is irresponsible for Fed users:

- **Citations mandatory in output schema.** If LLM produces no citations, flag the reaction as `low_grounding` and surface visually.
- **Profile + corpus freshness shown in UI.** Every persona card shows "Profile updated YYYY-MM-DD · Corpus refreshed N days ago."
- **Disclaimers persist.** Banner on every output: *"Simulated views grounded in public material. Not actual dealer commentary."*
- **Audit logs.** `reactions` table preserves prompt, retrieved chunks, and response. Auditable.

---

## 7. Success criteria (production Phase 1)

How we know we built the right thing:

1. **Persona fidelity check.** Pick 5 recent real events. Generate sim outputs. Have a Markets Group analyst blind-rate each persona against actual subsequent dealer commentary. Target: >70% rated "directionally correct," >50% rated "could plausibly be from this firm."
2. **Time to brief.** From event paste → printable comparative table in under 60 seconds wall-clock.
3. **Trust signals working.** Every reaction has at least 2 citations; freshness timestamps visible; disclaimers persistent.
4. **Honesty under uncertainty.** Persona produces low-confidence output (and says so) when given an event outside its normal coverage.
5. **One desk analyst uses it twice unprompted** within two weeks of access — real adoption signal.

---

## 8. Risks (production)

| Risk | Mitigation |
|---|---|
| R1 — Persona quality is generic | Rich profile + KB corpus + citations-mandatory + manual blind-rating |
| R2 — Bedrock/AgentCore API churn | Thin abstraction over Bedrock SDK; pin SDK versions |
| R3 — Public material thin for some firms | Profile carries more weight; surface "low corpus" warnings on those personas |
| R4 — User mistakes simulated for real | Persistent disclaimers, mandatory citations, explicit "simulated" labels, audit logs |
| R5 — Cost runaway from Bedrock | Per-sim cost budget alarms in CloudWatch, cheaper model fallback for sample/demo runs |
| R6 — Seed script breakage | Scrapers fail loud, dry-run mode, per-source error reports |

---

## 9. Open questions for production

- **Bedrock KB partitioning.** One KB with `metadata.persona_id` filter, or one KB per persona? Per-persona is cleaner but more KBs to manage. Decide before Phase 1.5.
- **Multilingual sources.** Some buy-side personas have non-English research. Punt to Phase 3.
- **Profile versioning.** When a profile is edited, do past simulations re-run? Probably no — old sims show profile-as-of-then.
- **Right to refresh.** If persona KB is mid-refresh when a sim runs, block or use stale? MVP: use stale, surface the timestamp.

---

## 10. Relationship to MiroFish

MarketSounding is **conceptually inspired by** MiroFish (multi-agent persona simulation grounded in knowledge graphs). Architecturally it diverges:

- MiroFish: Vue 3 + Flask + Python + Zep Cloud + OASIS
- MarketSounding: Next.js + TypeScript + AWS Bedrock + Bedrock KB

Reference material from MiroFish lives in `docs/inspiration/` — Python files preserved as prompt-engineering reference, not as runnable code.
