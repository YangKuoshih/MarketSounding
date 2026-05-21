import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { success, badRequest, serverError, methodNotAllowed } from '../../lib/response';
import { generateSearchQueries } from './query-generator';
import { searchTavily, TavilyResult } from './tavily-client';
import { synthesizeEventBrief } from './synthesizer';
import { getCachedResearch, cacheResearch } from './cache';
import { Source, ResearchResult } from './types';
import { sampleEvents } from '../../data/events/samples';
import { loadAllPersonas } from '../../data/personas';

const researchRequestSchema = z.object({
  topic: z.string().min(1, 'Topic is required').max(500, 'Topic must be 500 characters or less'),
  maxSources: z.number().int().min(1).max(10).optional().default(5),
  recency: z.enum(['day', 'week', 'month']).optional().default('week'),
});

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path || '';

  if (method === 'OPTIONS') {
    return success({});
  }

  // GET /events/samples (no auth required)
  if (method === 'GET' && path.endsWith('/events/samples')) {
    return success({ samples: sampleEvents });
  }

  // GET /personas (no auth required)
  if (method === 'GET' && path.endsWith('/personas')) {
    return success({
      personas: loadAllPersonas().map((p) => ({
        id: p.id,
        name: p.name,
        shortName: p.shortName,
        bias: p.defaultBias,
      })),
    });
  }

  if (method !== 'POST') {
    return methodNotAllowed();
  }

  try {
    return await handleResearch(event);
  } catch (error) {
    console.error('Research handler error:', error);
    return serverError('Internal server error');
  }
}

async function handleResearch(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseBody(event.body);
  if (!body) {
    return badRequest('Invalid request body');
  }

  const parsed = researchRequestSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    return badRequest(firstError.message);
  }

  const { topic, maxSources, recency } = parsed.data;

  // Check cache first
  const cached = await getCachedResearch(topic, recency);
  if (cached) {
    return success(cached as unknown as Record<string, unknown>);
  }

  // Step 1: Generate search queries using Haiku
  let searchQueries: string[];
  try {
    searchQueries = await generateSearchQueries(topic);
  } catch (error) {
    console.error('Query generation failed:', error);
    // Fallback to using the topic directly
    searchQueries = [topic];
  }

  // Step 2: Execute Tavily searches
  let allResults: TavilyResult[];
  try {
    allResults = await executeTavilySearches(searchQueries, maxSources);
  } catch (error) {
    console.error('Tavily search failed:', error);
    return success({
      error: 'Web search failed. Please try a different topic or paste your event text directly.',
      suggestion: 'paste',
    });
  }

  // Step 3: Filter and deduplicate results
  const filteredResults = filterAndDeduplicateResults(allResults, recency, maxSources);

  if (filteredResults.length === 0) {
    return success({
      error: 'No relevant results found for this topic. Please try a different topic or paste your event text directly.',
      suggestion: 'paste',
    });
  }

  // Step 4: Synthesize event brief using Opus
  let result: ResearchResult;
  try {
    result = await synthesizeEventBrief(topic, filteredResults, searchQueries);
  } catch (error) {
    console.error('Synthesis failed:', error);
    return serverError('Failed to synthesize event brief. Please try again.');
  }

  // Step 5: Cache the result
  await cacheResearch(topic, recency, result);

  return success(result as unknown as Record<string, unknown>);
}

async function executeTavilySearches(queries: string[], maxResults: number): Promise<TavilyResult[]> {
  const settled = await Promise.allSettled(
    queries.map((q) => searchTavily(q, maxResults))
  );

  const results: TavilyResult[] = [];
  for (const outcome of settled) {
    if (outcome.status === 'fulfilled') {
      results.push(...outcome.value);
    } else {
      console.warn('Tavily search failed for a query:', outcome.reason);
    }
  }

  if (results.length === 0) {
    throw new Error('All Tavily searches failed');
  }

  return results;
}

function filterAndDeduplicateResults(
  results: TavilyResult[],
  recency: 'day' | 'week' | 'month',
  maxSources: number
): TavilyResult[] {
  // Deduplicate by URL
  const seen = new Set<string>();
  const unique: TavilyResult[] = [];

  for (const result of results) {
    if (!seen.has(result.url)) {
      seen.add(result.url);
      unique.push(result);
    }
  }

  // Filter by recency
  const now = new Date();
  const cutoff = getRecencyCutoff(now, recency);
  const recencyFiltered = unique.filter((r) => {
    if (!r.published_date) return true; // Keep results without dates
    const pubDate = new Date(r.published_date);
    return pubDate >= cutoff;
  });

  // If recency filter removes everything, fall back to unfiltered unique results
  const candidates = recencyFiltered.length > 0 ? recencyFiltered : unique;

  // Sort by relevance score (descending) and take top N
  const sorted = candidates.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return sorted.slice(0, maxSources);
}

function getRecencyCutoff(now: Date, recency: 'day' | 'week' | 'month'): Date {
  const cutoff = new Date(now);
  switch (recency) {
    case 'day':
      cutoff.setDate(cutoff.getDate() - 1);
      break;
    case 'week':
      cutoff.setDate(cutoff.getDate() - 7);
      break;
    case 'month':
      cutoff.setMonth(cutoff.getMonth() - 1);
      break;
  }
  return cutoff;
}

function parseBody(body: string | null): Record<string, unknown> | null {
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}
