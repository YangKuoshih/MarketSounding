import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrockClient = new BedrockRuntimeClient({});
const HAIKU_MODEL_ID = process.env.BEDROCK_HAIKU_MODEL_ID || 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

/**
 * Generate 2-3 search query variants from a user topic using Haiku.
 * Haiku is cheap and fast, ideal for this utility task.
 */
export async function generateSearchQueries(topic: string): Promise<string[]> {
  const prompt = `You are a financial research assistant. Given a market/economic topic, generate 2-3 diverse web search queries that would find the most relevant and recent news articles about this topic.

Focus on:
- Current developments and breaking news
- Official announcements and policy decisions
- Market impact and analyst reactions

Topic: "${topic}"

Respond with ONLY a JSON array of search query strings. No explanation.
Example: ["query 1", "query 2", "query 3"]`;

  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const command = new InvokeModelCommand({
    modelId: HAIKU_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: Buffer.from(body),
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  const text = responseBody.content?.[0]?.text ?? '';

  // Parse the JSON array from the response
  const queries = parseQueriesFromResponse(text);

  if (queries.length === 0) {
    // Fallback: use the topic directly
    return [topic];
  }

  return queries.slice(0, 2); // 2 parallel searches is enough and faster
}

function parseQueriesFromResponse(text: string): string[] {
  try {
    // Try direct JSON parse
    const parsed = JSON.parse(text.trim());
    if (Array.isArray(parsed) && parsed.every((q) => typeof q === 'string')) {
      return parsed;
    }
  } catch {
    // Try to extract JSON array from text
    const match = text.match(/\[[\s\S]*?\]/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed) && parsed.every((q) => typeof q === 'string')) {
          return parsed;
        }
      } catch {
        // Fall through
      }
    }
  }

  return [];
}
