/**
 * Chat Agent Lambda
 *
 * Endpoint:
 *   POST /chat/{personaId}   { messages: [{role, content}] }  ->  { reply, personaId, model }
 *
 * Free-form conversational endpoint that lets users chat directly with one of
 * the 5 dealer personas. Distinct from the structured /simulations roundtable
 * agent — this returns plain text in the dealer's voice rather than a
 * Reaction JSON.
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
import { loadPersona, isValidPersonaId } from '../../data/personas';

const bedrockClient = new BedrockRuntimeClient({});
const OPUS_MODEL_ID =
  process.env.BEDROCK_OPUS_MODEL_ID || 'anthropic.claude-opus-4-7';
const HAIKU_MODEL_ID =
  process.env.BEDROCK_HAIKU_MODEL_ID || 'anthropic.claude-haiku-4-5';

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

    if (!isValidPersonaId(personaId)) {
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

    // Last message must be from the user
    if (messages[messages.length - 1].role !== 'user') {
      return badRequest('Last message must be from user');
    }

    try {
      const persona = loadPersona(personaId);
      const reply = await invokeChatModel(persona, messages);
      return success({
        reply,
        personaId,
        model: CHAT_MODEL_ID,
      });
    } catch (err) {
      console.error('Chat agent error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      return serverError(`Chat agent failed: ${message}`);
    }
  },
);

async function invokeChatModel(
  persona: ReturnType<typeof loadPersona>,
  messages: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  const systemPrompt = buildChatSystemPrompt(persona);

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

  if (!text) {
    throw new Error('Empty response from Bedrock');
  }

  return text;
}

function buildChatSystemPrompt(persona: ReturnType<typeof loadPersona>): string {
  return `You are simulating a research analyst at ${persona.name} (${persona.shortName}), a primary dealer in US Treasury securities. A user is having a casual conversation with you about markets, rates, and economic outlook.

PERSONA PROFILE:
${persona.profileMd}

VOICE INSTRUCTIONS:
- Speak in ${persona.name}'s established house voice — confident, specific, grounded in your typical analytical framework.
- Reference specific elements of the profile (named economists, prior calls, typical positioning) when relevant.
- Be honest about uncertainty — don't invent specific numbers or quotes you don't have.
- Keep responses concise: 2-4 paragraphs maximum unless the user explicitly asks for more depth.
- This is a CONVERSATION, not a formal report — use natural prose, not heavy bullet lists.
- IMPORTANT: Always include the disclaimer "Simulated views — not actual ${persona.shortName} commentary" only at the START of your first response if relevant. Never repeat across responses.

You are NOT the real ${persona.name}. You are a simulation grounded in publicly documented house views. Maintain that authenticity boundary if the user asks about non-public information or trading positions.`;
}
