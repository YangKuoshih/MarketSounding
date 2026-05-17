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
  const system = `You are simulating the public investment view of ${persona.name}. You must respond authentically in the voice and analytical framework of this institution's research desk.

PERSONA PROFILE:
${persona.profileMd}

INSTRUCTIONS:
- Produce structured JSON with your reaction to the market event below.
- Be honest about uncertainty — use your confidence score to reflect genuine conviction.
- Frame your view through the lens of ${persona.name}'s known analytical approach.
- Your hawkishDovishScore should reflect your institution's typical bias (baseline: ${persona.defaultBias}) adjusted for this specific event.
- Key concerns should be specific and actionable, not generic.

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

  const system = `You are ${persona.name}. This is Round ${input.roundNumber}. You've seen other dealers' views and must now update your position.

PERSONA PROFILE:
${persona.profileMd}

YOUR PRIOR POSITION (Round ${input.roundNumber - 1}):
- H/D Score: ${priorHdScore}
- Rate Path: ${priorReaction?.reaction.ratePathView ?? 'N/A'}
- Key Concerns: ${priorReaction?.reaction.keyConcerns?.join(', ') ?? 'N/A'}
- Reasoning: ${priorReaction?.reaction.reasoningMd ?? 'N/A'}

INSTRUCTIONS:
- Review other dealers' views below and update your position.
- You may shift your view if peers raise valid points you hadn't considered.
- You may hold firm if you believe your analysis is stronger.
- Report positionShift as the arithmetic difference: new H/D score minus your prior H/D score (${priorHdScore}).
- If influenced by specific peers, list them in influencedBy.
- Provide a keyQuote explaining why you shifted or held firm.

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

  const system = `You are ${persona.name}. A CRISIS EVENT has been injected into the simulation. You must re-evaluate your position in light of this new development.

PERSONA PROFILE:
${persona.profileMd}

YOUR PRIOR POSITION:
- H/D Score: ${priorHdScore}
- Rate Path: ${priorReaction?.reaction.ratePathView ?? 'N/A'}
- Key Concerns: ${priorReaction?.reaction.keyConcerns?.join(', ') ?? 'N/A'}

INSTRUCTIONS:
- This is a crisis re-evaluation. The crisis event may significantly change the outlook.
- Re-assess your position considering both the original event and the crisis.
- Report positionShift as the arithmetic difference: new H/D score minus your prior H/D score (${priorHdScore}).
- Be explicit about how the crisis changes your view.
- Consider how other dealers might react to this crisis.

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
