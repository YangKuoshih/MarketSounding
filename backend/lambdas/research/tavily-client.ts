import { getSecret } from '../../lib/secrets';

const TAVILY_API_KEY_ARN = process.env.TAVILY_API_KEY_ARN ?? '';
const TAVILY_API_URL = 'https://api.tavily.com/search';

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date: string | null;
  domain?: string;
}

interface TavilySearchResponse {
  results: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
    published_date?: string | null;
  }>;
}

/**
 * Execute a web search via Tavily API.
 * Returns filtered results with relevance scores.
 */
export async function searchTavily(query: string, maxResults: number = 5): Promise<TavilyResult[]> {
  const apiKey = await getSecret(TAVILY_API_KEY_ARN);

  const requestBody = {
    api_key: apiKey,
    query,
    max_results: maxResults,
    search_depth: 'advanced',
    include_domains: [],
    exclude_domains: [],
  };

  const response = await fetch(TAVILY_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Tavily API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as TavilySearchResponse;

  return (data.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    content: r.content,
    score: r.score ?? 0,
    published_date: r.published_date ?? null,
    domain: extractDomain(r.url),
  }));
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
