import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../lib/dynamodb';
import { ResearchResult } from './types';

const EVENTS_TABLE_NAME = process.env.EVENTS_TABLE_NAME ?? 'events';
const CACHE_TTL_HOURS = 6; // Cache research results for 6 hours
const IS_LOCAL = process.env.IS_LOCAL === 'true';

/**
 * Check if a recent research result exists for this topic + recency combination.
 * Uses a normalized cache key stored in the events table.
 * Skipped in local dev (no DynamoDB table available).
 */
export async function getCachedResearch(
  topic: string,
  recency: string
): Promise<ResearchResult | null> {
  if (IS_LOCAL) return null;

  const cacheKey = buildCacheKey(topic, recency);

  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: EVENTS_TABLE_NAME,
        Key: { id: cacheKey },
      })
    );

    if (!result.Item) {
      return null;
    }

    // Check if cache entry has expired
    const cachedAt = new Date(result.Item.cachedAt as string);
    const now = new Date();
    const ageHours = (now.getTime() - cachedAt.getTime()) / (1000 * 60 * 60);

    if (ageHours > CACHE_TTL_HOURS) {
      return null; // Expired
    }

    return result.Item.researchResult as ResearchResult;
  } catch (error) {
    console.warn('Cache lookup failed, proceeding without cache:', error);
    return null;
  }
}

/**
 * Store a research result in the cache for future lookups.
 * Skipped in local dev (no DynamoDB table available).
 */
export async function cacheResearch(
  topic: string,
  recency: string,
  result: ResearchResult
): Promise<void> {
  if (IS_LOCAL) return;

  const cacheKey = buildCacheKey(topic, recency);

  try {
    await docClient.send(
      new PutCommand({
        TableName: EVENTS_TABLE_NAME,
        Item: {
          id: cacheKey,
          type: 'research_cache',
          topic,
          recency,
          researchResult: result,
          cachedAt: new Date().toISOString(),
          ttl: Math.floor(Date.now() / 1000) + CACHE_TTL_HOURS * 3600, // DynamoDB TTL
        },
      })
    );
  } catch (error) {
    // Cache write failure is non-critical — log and continue
    console.warn('Failed to cache research result:', error);
  }
}

/**
 * Build a deterministic cache key from topic and recency.
 * Normalizes the topic to lowercase and trims whitespace.
 */
function buildCacheKey(topic: string, recency: string): string {
  const normalized = topic.toLowerCase().trim().replace(/\s+/g, '_');
  return `cache#${normalized}#${recency}`;
}
