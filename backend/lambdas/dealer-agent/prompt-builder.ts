/**
 * Prompt construction for dealer agent LLM invocations.
 * Builds round-appropriate prompts: initial, peer_response, crisis_reevaluation.
 */

import { PersonaProfile } from '../../data/personas';
import { DealerAgentInput, PeerReaction } from './types';
import { DealerSessionState } from '../../lib/session-state';

export interface BedrockMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface PromptPayload {
  system: string;
  messages: BedrockMessage[];
}

const MAX_EVENT_TEXT_LENGTH = 12000;

const REACTION_SCHEMA_INSTRUCTION = `Produce a JSON response with these exact fields:
{
  "ratePathView": "your view on the rate path (1-2 sentences)",
  "balanceSheetView": "your view on balance sheet policy (1-2 sentences)",
  "riskAssetView": "your view on risk assets (1-2 sentences)",
  "keyConcerns": ["1-3 key concerns as strings"],
  "hawkishDovishScore": number between -1 (very dovish) and +1 (very hawkish),
  "confidence": number between 0 (no confidence) and 1 (very confident),
  "reasoningMd": "2-3 paragraphs of reasoning in markdown, written in your persona's voice",
  "positionShift": number or null (change from your prior round H/D score, null for round 1),
  "influencedBy": ["persona IDs that influenced your view update"] or null,
  "keyQuote": "one sentence explaining your shift reasoning or reason for holding firm"
}

Respond with ONLY the JSON object. No markdown code blocks, no explanation outside the JSON.`;

/**
 * Build the full prompt payload for a dealer agent invocation.
 */
export function buildDealerPrompt(
  persona: PersonaProfile,
  input: DealerAgentInput,
  sessionState: DealerSessionState
): PromptPayload {
  switch (input.roundType) {
    case 'initial':
      return buildInitialPrompt(persona, input);
    case 'peer_response':
      return buildPeerResponsePrompt(persona, input, sessionState);
    case 'crisis_reevaluation':
      return buildCrisisPrompt(persona, input, sessionState);
    default:
      throw new Error(`Unknown round type: ${input.roundType}`);
  }
}

function buildInitialPrompt(persona: PersonaProfile, input: DealerAgentInput): PromptPayload {
  const system = `You are the research desk of ${persona.name} (${persona.shortName}), a primary dealer in US Treasury securities. Produce a structured JSON market reaction — nothing else.

PERSONA PROFILE:
${persona.profileMd}

HOUSE VOICE:
${persona.voiceCharacteristics.map((v) => `- ${v}`).join('\n')}

TYPICAL CONCERNS THIS DESK WEIGHS:
${persona.typicalConcerns.map((c) => `- ${c}`).join('\n')}

KNOWN BLIND SPOTS (avoid these failure modes):
${persona.blindSpots.map((b) => `- ${b}`).join('\n')}

STRICT RULES:
- Stay entirely within ${persona.name}'s documented analytical framework — no cross-contamination from other dealers' styles
- Do NOT invent specific internal models, proprietary data, or non-public positions
- keyConcerns must be institution-specific, not generic macro observations
- reasoningMd must read unmistakably as ${persona.shortName} — a reader should identify the author without seeing the name
- No editorializing outside ${persona.name}'s known framework; no political commentary

HAWKISH/DOVISH SCORE CALIBRATION (CRITICAL):
- This desk's default institutional lean is ${persona.defaultBias} (−1 = max dovish, +1 = max hawkish)
- Your score MUST reflect how THIS SPECIFIC EVENT shifts YOUR framework — don't stay near the default unless the event is truly neutral
- Rate-CUT events: dovish dealers (GS, Citi) should score negative (−0.3 to −0.7); hawkish dealers (MS, BofA) still score more positive than dovish dealers even if they approve the cut
- Rate-HIKE or inflation shock events: hawkish dealers score positive (0.4 to 0.9); dovish dealers score less negative
- Trade/tariff/geopolitical events: use your desk's known framework — MS leans hawkish (inflation risk), GS leans dovish (growth risk), BofA watches consumer impact
- The 5 dealers MUST produce meaningfully different scores (spread of at least 0.6 across the group) — identical or similar scores indicate you are not applying your distinct framework
- Score the event itself, not just your prior lean: a 50bp Fed cut should produce scores ranging from ~−0.6 (GS/Citi) to ~+0.2 (MS/BofA who still see inflation risk)

${REACTION_SCHEMA_INSTRUCTION}`;

  const eventText = truncateEventText(input.eventContext.eventText);
  const userMessage = `EVENT (occurring ${input.eventContext.eventDate ?? 'recently'}):
${input.eventContext.eventSummary}

FULL TEXT:
${eventText}`;

  return {
    system,
    messages: [{ role: 'user', content: userMessage }],
  };
}

function buildPeerResponsePrompt(
  persona: PersonaProfile,
  input: DealerAgentInput,
  sessionState: DealerSessionState
): PromptPayload {
  const priorReaction = sessionState.priorReactions.length > 0
    ? sessionState.priorReactions[sessionState.priorReactions.length - 1]
    : null;

  const priorHdScore = priorReaction?.reaction.hawkishDovishScore ?? persona.defaultBias;

  const system = `You are the research desk of ${persona.name} (${persona.shortName}). Round ${input.roundNumber} — you have now seen other dealers' positions and must update yours. Produce structured JSON — nothing else.

PERSONA PROFILE:
${persona.profileMd}

HOUSE VOICE:
${persona.voiceCharacteristics.map((v) => `- ${v}`).join('\n')}

YOUR PRIOR POSITION (Round ${input.roundNumber - 1}):
- H/D Score: ${priorHdScore}
- Rate Path: ${priorReaction?.reaction.ratePathView ?? 'N/A'}
- Key Concerns: ${priorReaction?.reaction.keyConcerns?.join(', ') ?? 'N/A'}
- Reasoning: ${priorReaction?.reaction.reasoningMd ?? 'N/A'}

PEER UPDATE RULES:
- Engage with peer views critically but in ${persona.name}'s voice — do not adopt another desk's framing
- You may shift if a peer raises a data point or framework you genuinely find compelling; you may hold if you disagree
- positionShift = new H/D score minus your prior score (${priorHdScore}); keep shifts realistic (max ±0.3 per round unless the event warrants more)
- influencedBy: only list peers whose specific argument actually moved you
- keyQuote must sound unmistakably like ${persona.shortName} — not generic
- NEVER mimic another desk's voice; your reasoning must remain distinctly ${persona.shortName}
- MAINTAIN YOUR INSTITUTIONAL CHARACTER: if your desk is structurally hawkish (MS, BofA), you remain MORE hawkish than GS/Citi even after hearing their arguments; if your desk is structurally dovish (GS, Citi), you remain MORE dovish than MS/BofA
- Do NOT converge to the group mean — the debate enriches your reasoning but your H/D score must stay in your desk's characteristic range

${REACTION_SCHEMA_INSTRUCTION}`;

  const peerContext = formatPeerReactions(input.peerReactions ?? []);
  const userMessage = `OTHER DEALERS' VIEWS (Round ${input.roundNumber - 1}):
${peerContext}

Update your view considering these perspectives. Your prior H/D score was ${priorHdScore}.`;

  return {
    system,
    messages: [{ role: 'user', content: userMessage }],
  };
}

function buildCrisisPrompt(
  persona: PersonaProfile,
  input: DealerAgentInput,
  sessionState: DealerSessionState
): PromptPayload {
  const priorReaction = sessionState.priorReactions.length > 0
    ? sessionState.priorReactions[sessionState.priorReactions.length - 1]
    : null;

  const priorHdScore = priorReaction?.reaction.hawkishDovishScore ?? persona.defaultBias;

  const system = `You are the research desk of ${persona.name} (${persona.shortName}). A CRISIS EVENT has been injected — re-evaluate your position. Produce structured JSON — nothing else.

PERSONA PROFILE:
${persona.profileMd}

HOUSE VOICE:
${persona.voiceCharacteristics.map((v) => `- ${v}`).join('\n')}

YOUR PRIOR POSITION:
- H/D Score: ${priorHdScore}
- Rate Path: ${priorReaction?.reaction.ratePathView ?? 'N/A'}
- Key Concerns: ${priorReaction?.reaction.keyConcerns?.join(', ') ?? 'N/A'}

CRISIS RE-EVALUATION RULES:
- Assess the crisis through ${persona.name}'s specific analytical lens — not a generic macro reaction
- How does this crisis interact with ${persona.name}'s known blind spots or strengths?
- positionShift = new H/D score minus prior score (${priorHdScore}); large shifts are acceptable for genuine tail risks
- reasoningMd must explicitly explain why ${persona.shortName}'s framework leads to this re-assessment
- NEVER produce a generic "risk-off" response; the reaction must be characteristically ${persona.shortName}

${REACTION_SCHEMA_INSTRUCTION}`;

  const eventText = truncateEventText(input.eventContext.eventText);
  const peerContext = formatPeerReactions(input.peerReactions ?? []);
  const crisisText = input.crisisEvent?.crisisText ?? '';

  const userMessage = `ORIGINAL EVENT:
${input.eventContext.eventSummary}

${eventText}

---

CRISIS EVENT:
${crisisText}

---

PEER POSITIONS (prior to crisis):
${peerContext || 'No peer positions available.'}

Re-evaluate your position. Your prior H/D score was ${priorHdScore}.`;

  return {
    system,
    messages: [{ role: 'user', content: userMessage }],
  };
}

function formatPeerReactions(peerReactions: PeerReaction[]): string {
  if (peerReactions.length === 0) return 'No peer reactions available.';

  return peerReactions
    .map(
      (peer) => `### ${peer.personaName} (${peer.personaId})
- **H/D Score:** ${peer.hawkishDovishScore.toFixed(2)}
- **Confidence:** ${peer.confidence.toFixed(2)}
- **Rate Path:** ${peer.ratePathView}
- **Balance Sheet:** ${peer.balanceSheetView}
- **Risk Assets:** ${peer.riskAssetView}
- **Key Concerns:** ${peer.keyConcerns.join('; ')}
- **Reasoning:** ${peer.reasoningMd}
${peer.keyQuote ? `- **Key Quote:** "${peer.keyQuote}"` : ''}`
    )
    .join('\n\n');
}

function truncateEventText(text: string): string {
  if (text.length <= MAX_EVENT_TEXT_LENGTH) return text;
  return text.slice(0, MAX_EVENT_TEXT_LENGTH) + '\n\n[...truncated for context window]';
}
