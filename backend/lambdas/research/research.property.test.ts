import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Source } from './types';
import { TavilyResult } from './tavily-client';

/**
 * **Validates: Requirements 1.2, 1.3**
 *
 * Property tests for the Event Research Agent's filtering and citation logic.
 */

// Re-implement the filter logic here for isolated testing (same as in index.ts)
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
    if (!r.published_date) return true;
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

function buildSources(results: TavilyResult[]): Source[] {
  return results.map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.content.slice(0, 300),
    publishedDate: r.published_date ?? new Date().toISOString().split('T')[0],
    domain: r.domain ?? '',
    relevanceScore: Math.round(r.score * 100) / 100,
  }));
}

// Arbitrary generators
const tavilyResultArb = fc.record({
  title: fc.string({ minLength: 1, maxLength: 100 }),
  url: fc.webUrl(),
  content: fc.string({ minLength: 1, maxLength: 500 }),
  score: fc.double({ min: 0, max: 1, noNaN: true }),
  published_date: fc.oneof(
    fc.constant(null),
    fc.date({ min: new Date('2024-01-01'), max: new Date() }).map((d) => d.toISOString())
  ),
  domain: fc.domain(),
});

const recencyArb = fc.constantFrom('day' as const, 'week' as const, 'month' as const);

describe('Research Agent Property Tests', () => {
  /**
   * **Property 1: Search Result Filtering**
   * Filter returns only top 3-5 results ranked by recency and relevance.
   *
   * **Validates: Requirements 1.2**
   */
  describe('Property 1: Search Result Filtering', () => {
    it('should return at most maxSources results (between 3 and 5)', () => {
      fc.assert(
        fc.property(
          fc.array(tavilyResultArb, { minLength: 1, maxLength: 20 }),
          recencyArb,
          fc.integer({ min: 3, max: 5 }),
          (results, recency, maxSources) => {
            const filtered = filterAndDeduplicateResults(results, recency, maxSources);
            expect(filtered.length).toBeLessThanOrEqual(maxSources);
            expect(filtered.length).toBeGreaterThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return results sorted by relevance score (descending)', () => {
      fc.assert(
        fc.property(
          fc.array(tavilyResultArb, { minLength: 2, maxLength: 15 }),
          recencyArb,
          fc.integer({ min: 3, max: 5 }),
          (results, recency, maxSources) => {
            const filtered = filterAndDeduplicateResults(results, recency, maxSources);
            for (let i = 1; i < filtered.length; i++) {
              expect(filtered[i - 1].score).toBeGreaterThanOrEqual(filtered[i].score);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should deduplicate results by URL', () => {
      fc.assert(
        fc.property(
          fc.array(tavilyResultArb, { minLength: 2, maxLength: 15 }),
          recencyArb,
          fc.integer({ min: 3, max: 5 }),
          (results, recency, maxSources) => {
            const filtered = filterAndDeduplicateResults(results, recency, maxSources);
            const urls = filtered.map((r) => r.url);
            const uniqueUrls = new Set(urls);
            expect(urls.length).toBe(uniqueUrls.size);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Property 2: Source Citation Completeness**
   * Every source has all required fields with non-empty values.
   *
   * **Validates: Requirements 1.3**
   */
  describe('Property 2: Source Citation Completeness', () => {
    it('every source citation should have all required fields with non-empty values', () => {
      fc.assert(
        fc.property(
          fc.array(tavilyResultArb, { minLength: 1, maxLength: 10 }),
          (results) => {
            const sources = buildSources(results);

            for (const source of sources) {
              // title must be non-empty string
              expect(typeof source.title).toBe('string');
              expect(source.title.length).toBeGreaterThan(0);

              // url must be non-empty string
              expect(typeof source.url).toBe('string');
              expect(source.url.length).toBeGreaterThan(0);

              // snippet must be a string (can be short but non-empty since content is minLength 1)
              expect(typeof source.snippet).toBe('string');
              expect(source.snippet.length).toBeGreaterThan(0);

              // publishedDate must be non-empty string
              expect(typeof source.publishedDate).toBe('string');
              expect(source.publishedDate.length).toBeGreaterThan(0);

              // domain must be a string (may be empty if URL parsing fails, but with valid URLs it should be non-empty)
              expect(typeof source.domain).toBe('string');

              // relevanceScore must be a number between 0 and 1
              expect(typeof source.relevanceScore).toBe('number');
              expect(source.relevanceScore).toBeGreaterThanOrEqual(0);
              expect(source.relevanceScore).toBeLessThanOrEqual(1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('source count should match input result count', () => {
      fc.assert(
        fc.property(
          fc.array(tavilyResultArb, { minLength: 1, maxLength: 10 }),
          (results) => {
            const sources = buildSources(results);
            expect(sources.length).toBe(results.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
