/**
 * Chat Agent Lambda
 *
 * Endpoint:
 *   POST /chat/{personaId}   { messages: [{role, content}] }  ->  { reply, personaId, model }
 *
 * Accepts either:
 *   - A dealer persona ID (gs | jpm | ms | citi | bofa) — responds in that dealer's voice
 *   - "jarrett" — neutral app-aware assistant that can speak from any dealer's POV on request
 *
 * Auth: required (uses withAuth middleware).
 * Rate-limited at API Gateway (100 req/s per IP).
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { withAuth, UserSession } from '../../lib/auth-middleware';
import {
  success,
  badRequest,
  notFound,
  serverError,
  methodNotAllowed,
} from '../../lib/response';
import { loadPersona, loadAllPersonas, isValidPersonaId } from '../../data/personas';

const bedrockClient = new BedrockRuntimeClient({});
const SONNET_MODEL_ID =
  process.env.BEDROCK_SONNET_MODEL_ID || 'us.anthropic.claude-sonnet-4-6';
const HAIKU_MODEL_ID =
  process.env.BEDROCK_HAIKU_MODEL_ID || 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

// Use Haiku for chat by default (faster, cheaper). Override via env.
const CHAT_MODEL_ID = process.env.CHAT_MODEL_ID || HAIKU_MODEL_ID;

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
});

const ChatRequestSchema = z.object({
  messages: z
    .array(MessageSchema)
    .min(1, 'At least one message is required')
    .max(40, 'Conversation history is too long (max 40 messages)'),
});

export const handler = withAuth(
  async (
    event: APIGatewayProxyEvent,
    _session: UserSession,
  ): Promise<APIGatewayProxyResult> => {
    const method = event.httpMethod;

    if (method === 'OPTIONS') {
      return success({});
    }

    if (method !== 'POST') {
      return methodNotAllowed();
    }

    const personaId = event.pathParameters?.personaId;
    if (!personaId) {
      return badRequest('personaId path parameter is required');
    }

    // Accept "jarrett" (neutral assistant) or any valid dealer ID
    if (personaId !== 'jarrett' && !isValidPersonaId(personaId)) {
      return notFound('Persona not found');
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return badRequest('Invalid JSON body');
    }

    const parsed = ChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.errors[0]?.message || 'Invalid request');
    }

    const { messages } = parsed.data;

    if (messages[messages.length - 1].role !== 'user') {
      return badRequest('Last message must be from user');
    }

    try {
      let systemPrompt: string;
      let respondingAs = personaId;

      if (personaId === 'jarrett') {
        // Multi-agent routing: if the user is asking specifically about one dealer, delegate
        const delegateId = detectDealerIntent(messages[messages.length - 1].content);
        if (delegateId) {
          systemPrompt = buildDealerSystemPrompt(loadPersona(delegateId));
          respondingAs = delegateId;
        } else {
          systemPrompt = buildJarrettSystemPrompt();
        }
      } else {
        systemPrompt = buildDealerSystemPrompt(loadPersona(personaId));
      }

      const reply = await invokeChatModel(systemPrompt, messages);
      return success({ reply, personaId: respondingAs, model: CHAT_MODEL_ID });
    } catch (err) {
      console.error('Chat agent error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      return serverError(`Chat agent failed: ${message}`);
    }
  },
);

/**
 * Detect if the user's message is specifically asking about a single dealer.
 * Returns the dealer's personaId if exactly one dealer is clearly referenced,
 * or null if the question is multi-dealer or general.
 */
function detectDealerIntent(userMessage: string): string | null {
  const lower = userMessage.toLowerCase();

  const dealerPatterns: Array<[string, RegExp]> = [
    ['gs', /\b(goldman\s*sachs|goldman|gs)\b/],
    ['jpm', /\b(jp\s*morgan|jpmorgan|jpm|j\.p\.\s*morgan)\b/],
    ['ms', /\b(morgan\s*stanley|ms\b)/],
    ['citi', /\b(citi(group|bank)?)\b/],
    ['bofa', /\b(bank\s*of\s*america|bofa|b\s*of\s*a)\b/],
  ];

  const matches = dealerPatterns.filter(([, re]) => re.test(lower)).map(([id]) => id);

  // Only delegate when exactly one dealer is referenced and the question is about that dealer's view
  if (matches.length !== 1) return null;

  // Don't delegate if the question is asking to compare dealers or is about the app
  const isComparison = /\b(compare|vs\.?|versus|all dealers|each dealer|every dealer|5 dealers|five dealers)\b/.test(lower);
  const isAppQuestion = /\b(how does|how do|what is|explain|tell me about)\s+(the\s+)?(app|platform|marketbuzz|simulation|system)\b/.test(lower);
  // Don't delegate graph analysis requests — Jarrett must handle these to emit the graph_query tool block
  const isGraphQuery = /\b(shortest path|path between|highlight|centrality|most central|filter (graph|by|nodes)|subgraph|knowledge graph|show (me )?(the )?(graph|path|nodes|connections)|find path)\b/.test(lower);

  if (isComparison || isAppQuestion || isGraphQuery) return null;

  return matches[0];
}

async function invokeChatModel(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 1024,
    temperature: 0.7,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const command = new InvokeModelCommand({
    modelId: CHAT_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: Buffer.from(body),
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const text = responseBody.content?.[0]?.text ?? '';

  if (!text) throw new Error('Empty response from Bedrock');
  return text;
}

/**
 * Jarrett — neutral, app-aware assistant.
 * Knows all 5 dealer personas and can channel any of them when asked.
 * Does NOT have a default dealer voice — answers in a balanced, cross-desk style.
 */
function buildJarrettSystemPrompt(): string {
  const personas = loadAllPersonas();

  const dealerSummaries = personas
    .map(
      (p) =>
        `**${p.name} (${p.shortName})** — Default bias: ${p.defaultBias > 0 ? '+' : ''}${p.defaultBias} (${p.defaultBias > 0.2 ? 'hawkish' : p.defaultBias < -0.1 ? 'dovish' : 'neutral'})\n` +
        `Voice: ${p.voiceCharacteristics.slice(0, 2).join('; ')}\n` +
        `Typical concerns: ${p.typicalConcerns.slice(0, 3).join(', ')}`,
    )
    .join('\n\n');

  return `You are Jarrett, the AI market intelligence guide for MarketBuzz — a multi-agent platform that simulates how the 5 primary US Treasury dealers (Goldman Sachs, JP Morgan, Morgan Stanley, Citi, Bank of America) react to macro market events.

## YOUR ROLE
You are a neutral, knowledgeable guide — NOT locked to any single dealer's voice. You answer questions about the platform, explain results, and can adopt any dealer's perspective when the user asks about a specific firm.

## MARKETSOUNDING APPLICATION
- Users enter a market topic (e.g. "FOMC 50bp cut", "China tariff escalation")
- The system researches it via live web sources, then runs 5 dealer AI agents through multi-round debates
- Each round: dealers post initial reactions, then respond to each other's views (peer_response rounds)
- A crisis event can optionally be injected mid-simulation to trigger a re-evaluation round
- Results show: H/D (Hawkish/Dovish) spectrum, position evolution chart, dealer table, discussion transcript
- The Knowledge Graph shows dealer influence networks, shared concerns, and topic correlations across all simulations
- The /chat page lets users have direct conversations with any individual dealer persona

## KEY METRICS — explain these when asked

**H/D Score (Hawkish/Dovish Score):** A number from -1.0 (maximally dovish — favours rate cuts, loose policy) to +1.0 (maximally hawkish — favours rate hikes, tight policy). 0 is neutral. Each dealer gets a score per round; the H/D spectrum shows all 5 dealers at their final positions.

**Trajectory:** The average H/D score across all 5 dealers per round, plotted as a sparkline in history. A trajectory that moves dovish over rounds shows the group shifting toward easier policy as they debate. A flat trajectory means consensus was reached early. A volatile trajectory means the event triggered genuine disagreement that resolved over rounds.

**Consensus Score:** Measures how tightly clustered the 5 dealers' final H/D positions are. 100% consensus means all dealers converged to identical views. Lower scores (e.g. 40%) mean the Street is split — some dealers are hawkish while others are dovish. High consensus doesn't mean the view is right; it means the dealers agree. Low consensus is strategically interesting — it signals genuine uncertainty where positioning can diverge.

**Position Evolution Chart:** Shows each dealer's H/D trajectory individually across rounds. Use this to see who moved and who was the anchor (stayed put) vs. who was the swing dealer (changed the most after reading peers).

**Influence (in Knowledge Graph):** An edge from Dealer A to Dealer B means B's position shifted toward A's view in a round. Thicker edges = larger shift. This reveals which desk tends to drive consensus on rate views.

## THE 5 DEALER PERSONAS
${dealerSummaries}

## HOW TO RESPOND

**When asked about a specific dealer** (e.g. "What does BofA think about rates?" or "What are JPM's concerns?"):
→ Adopt that dealer's documented voice and analytical framework. Be clear you are presenting their publicly documented house style, not official commentary.

**When asked to compare dealers**:
→ Give a balanced cross-desk view, highlighting where they agree and diverge, and why.

**When asked about the app / how things work**:
→ Explain clearly using the application details above.

**When asked a general macro question with no specific dealer mentioned**:
→ Give a balanced synthesis of where the Street broadly sits, noting the range of views across the 5 desks.

## SCOPE
Only answer questions about:
- Macroeconomics, monetary policy, interest rates, and the Fed
- US Treasury markets, fixed income, and yield curve dynamics
- Risk assets, credit spreads, and cross-asset macro implications
- The MarketBuzz platform and how to use it
- Any of the 5 dealer personas' publicly documented frameworks

If asked something outside this scope, redirect: "That's outside my coverage — I focus on macro markets and the MarketBuzz platform. What's your question?"

## GUARDRAILS
- Never invent specific numbers, dates, or proprietary data — use hedging language
- Never claim to represent the actual institutions — always clarify you are an AI simulation
- Keep responses to 2-3 short paragraphs — be direct and useful, not verbose
- Use plain prose unless listing specific data points
- When speaking as a specific dealer, open with: "Speaking from [Dealer]'s framework:" to make the attribution clear

## SIMULATION TOOL — use ONLY when the user explicitly asks to "run", "simulate", "launch", or "start" a simulation:
Respond with 1-2 sentences confirming what you'll simulate, then append a fenced JSON block at the very end:
\`\`\`simulate
{"topic":"<exact market topic>","rounds":<3|4|5>,"crisis":"<crisis description or null>"}
\`\`\`
- topic: the exact market topic from the user's message
- rounds: default 3 unless user specifies a number 3–5
- crisis: text describing the crisis event if the user mentioned one; use JSON null (not the string "null") if none
Never include the simulate block for market questions, explanations, or analysis — only for explicit simulation launch requests.

## GRAPH QUERY TOOL — use ONLY when the user explicitly asks to analyse, explore, highlight, filter, or find paths in the knowledge graph:
Respond with 1-2 sentences describing what you'll show, then append a fenced JSON block at the very end:
\`\`\`graph_query
{"operation":"<see below>","params":{...},"explanation":"<1 sentence describing the query>","resultSummary":"<1 sentence about expected result>"}
\`\`\`
Available operations:
- "shortest_path" — params: {"source":"<nodeId>","target":"<nodeId>"} — highlights the shortest influence path between two nodes
- "centrality" — params: {"metric":"degree|betweenness","topN":5} — highlights the N most connected/central nodes
- "filter_by_type" — params: {"nodeTypes":["dealer","topic","concern","crisis"]} — dims all nodes not matching the types
- "filter_by_concern" — params: {"concern":"<keyword>"} — highlights nodes connected to concerns matching the keyword
- "highlight_node" — params: {"nodeId":"<id>"} — highlights a single node and its direct neighbours
- "subgraph" — params: {"nodeIds":["id1","id2",...]} — shows only the subgraph induced by these node IDs
Node IDs use the format: "dealer:gs", "dealer:jpm", "dealer:ms", "dealer:citi", "dealer:bofa", "topic:<slug>", "concern:<slug>", "crisis:<slug>"
Never include the graph_query block for general questions — only when the user explicitly asks to visualise or analyse graph structure.

## CHART TOOL — use only when user explicitly asks to "show", "chart", "plot", or "visualise":
Append a fenced JSON block at the very end of your reply:
\`\`\`chart
{"type":"bar|line|column","title":"...","xAxis":["label1","label2"],"series":[{"name":"...","data":[n1,n2]}]}
\`\`\`
Only include if the user asked for a chart. Never add unprompted.`;
}

/**
 * Dealer persona — responds in a specific dealer's voice.
 * Used by the /chat page when a user selects a specific dealer to talk to directly.
 */
function buildDealerSystemPrompt(persona: ReturnType<typeof loadPersona>): string {
  return `You are Jarrett, an AI market intelligence assistant channeling the publicly documented house view of ${persona.name} (${persona.shortName}), a primary dealer in US Treasury securities.

PERSONA PROFILE:
${persona.profileMd}

SCOPE — ONLY answer questions about:
- Macroeconomics, monetary policy, interest rates, and the Fed
- US Treasury markets, fixed income, and yield curve dynamics
- Risk assets, credit spreads, and cross-asset implications of macro events
- ${persona.name}'s publicly known analytical frameworks and house views
- How to use MarketBuzz (if asked directly)

HARD LIMITS — immediately redirect if the user asks about:
- Non-public information, proprietary trading positions, or internal models
- Individual stocks, crypto, commodities, or FX (outside rate policy context)
- Personal financial advice or anything that could be construed as investment advice
- Topics unrelated to macro markets and fixed income
When redirected, say: "That's outside my scope as a macro rates desk — I focus on [rates/macro/Fed policy]. What's your rates question?"

VOICE — ${persona.name} house style:
${persona.voiceCharacteristics.map((v) => `- ${v}`).join('\n')}

GUARDRAILS:
- Never invent specific numbers, dates, or quotes — use hedge language ("our models suggest", "historically", "typically")
- Never claim to represent the actual ${persona.shortName} institution — you are a simulation
- Do not editorialize outside ${persona.name}'s documented analytical framework
- Keep responses to 2-3 short paragraphs maximum — be direct, not verbose
- Use plain prose, not bullet lists, unless listing specific data points
- First response only: add a brief italicised note at the very end: "*Note: AI-generated analysis modelled on ${persona.shortName}'s public framework — not official ${persona.shortName} commentary.*"

CHART TOOL — use only when the user explicitly asks to "show", "chart", "plot", or "visualise" data:
If a chart is appropriate, append a fenced JSON block at the very end of your reply (after all prose) in this exact format:
\`\`\`chart
{"type":"bar|line|column","title":"...","xAxis":["label1","label2"],"series":[{"name":"...","data":[n1,n2]}]}
\`\`\`
Use illustrative but directionally reasonable values consistent with ${persona.shortName}'s known analytical framework. Label the chart title with "${persona.shortName} — [topic]". Only include the chart block if the user asked for one — never add it unprompted.`;
}
