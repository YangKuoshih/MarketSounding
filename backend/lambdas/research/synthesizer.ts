import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { nanoid } from 'nanoid';
import { TavilyResult } from './tavily-client';
import { Event, Source, ResearchResult } from './types';

const bedrockClient = new BedrockRuntimeClient({});
const OPUS_MODEL_ID = 'anthropic.claude-opus-4-7';

/**
 * Synthesize top search results into a structured Event brief using Opus 4.7.
 * Returns the event record and source citations.
 */
export async function synthesizeEventBrief(
  topic: string,
  results: TavilyResult[],
  searchQueries: string[]
): Promise<ResearchResult> {
  const sources = buildSources(results);
  const sourcesContext = formatSourcesForPrompt(results);

  const prompt = `You are a financial news analyst. Given web search results about a market/political topic, synthesize them into a single coherent event brief suitable for primary dealer analysis.

TOPIC: "${topic}"

SEARCH RESULTS:
${sourcesContext}

Produce a JSON event brief with these exact fields:
{
  "title": "concise headline (max 80 chars)",
  "summary": "2-3 sentence summary of the key development",
  "rawText": "detailed 500-1000 word synthesis of all sources, written as a news brief",
  "eventDate": "ISO date of the most recent development (YYYY-MM-DD)"
}

Respond with ONLY the JSON object. No explanation or markdown formatting.`;

  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const command = new InvokeModelCommand({
    modelId: OPUS_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: Buffer.from(body),
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const text = responseBody.content?.[0]?.text ?? '';

  const synthesized = parseSynthesisResponse(text);

  const event: Event = {
    id: nanoid(),
    title: synthesized.title,
    source: 'researched',
    rawText: synthesized.rawText,
    summary: synthesized.summary,
    eventDate: synthesized.eventDate,
    createdAt: new Date().toISOString(),
    userId: '', // Will be set by the caller or auth middleware
  };

  return {
    event,
    sources,
    searchQueries,
  };
}

function buildSources(results: TavilyResult[]): Source[] {
  return results.map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.content.slice(0, 300),
    publishedDate: r.published_date ?? new Date().toISOString().split('T')[0],
    domain: r.domain ?? extractDomain(r.url),
    relevanceScore: Math.round(r.score * 100) / 100,
  }));
}

function formatSourcesForPrompt(results: TavilyResult[]): string {
  return results
    .map(
      (r, i) =>
        `[${i + 1}] ${r.title} (${r.domain ?? 'unknown'}, ${r.published_date ?? 'unknown date'})\n${r.content}\n---`
    )
    .join('\n');
}

interface SynthesisOutput {
  title: string;
  summary: string;
  rawText: string;
  eventDate: string;
}

function parseSynthesisResponse(text: string): SynthesisOutput {
  // Try direct JSON parse
  try {
    const parsed = JSON.parse(text.trim());
    return validateSynthesisOutput(parsed);
  } catch {
    // Try to extract JSON from markdown code block or surrounding text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return validateSynthesisOutput(parsed);
      } catch {
        // Fall through
      }
    }
  }

  throw new Error('Failed to parse synthesis response from Opus');
}

function validateSynthesisOutput(obj: Record<string, unknown>): SynthesisOutput {
  const title = typeof obj.title === 'string' ? obj.title.slice(0, 80) : 'Untitled Event';
  const summary = typeof obj.summary === 'string' ? obj.summary : '';
  const rawText = typeof obj.rawText === 'string' ? obj.rawText : '';
  const eventDate =
    typeof obj.eventDate === 'string' ? obj.eventDate : new Date().toISOString().split('T')[0];

  if (!rawText) {
    throw new Error('Synthesis response missing rawText');
  }

  return { title, summary, rawText, eventDate };
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
