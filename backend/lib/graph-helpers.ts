/**
 * Graph extraction helpers, separated from the graph-builder Lambda
 * to enable unit + property testing.
 */

/**
 * Normalize a free-text concern into a kebab-case tag.
 *
 *   "Wage Growth" -> "wage-growth"
 *   "Core PCE!" -> "core-pce"
 */
export function normalizeConcern(concern: string): string {
  return concern
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

/**
 * Classify a normalized concern into one of four categories based on keywords.
 */
export function classifyConcern(concern: string): 'macro' | 'market' | 'geopolitical' | 'policy' {
  const macroKeywords = ['inflation', 'rate', 'gdp', 'employment', 'wage', 'fed', 'monetary', 'fiscal'];
  const marketKeywords = ['equity', 'bond', 'credit', 'spread', 'volatility', 'liquidity'];
  const geoKeywords = ['geopolitical', 'war', 'tariff', 'trade', 'sanction', 'oil', 'energy'];

  const lower = concern.toLowerCase();
  if (macroKeywords.some((k) => lower.includes(k))) return 'macro';
  if (marketKeywords.some((k) => lower.includes(k))) return 'market';
  if (geoKeywords.some((k) => lower.includes(k))) return 'geopolitical';
  return 'policy';
}

/**
 * Compute Jaccard similarity between two sets:
 *   J(A, B) = |A ∩ B| / |A ∪ B|
 *
 * Returns 0 if both sets are empty.
 */
export function computeJaccardSimilarity<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  if (union === 0) return 0;
  return intersection / union;
}

/**
 * Decide whether two topics should have a correlation edge based on their concerns.
 * Uses Jaccard similarity > 0.3 as the threshold.
 */
export function shouldCreateCorrelationEdge(
  topicAConcerns: Set<string>,
  topicBConcerns: Set<string>,
  threshold = 0.3,
): boolean {
  const similarity = computeJaccardSimilarity(topicAConcerns, topicBConcerns);
  return similarity > threshold;
}

/**
 * Aggregate parallel influence edges between the same dealer pair into a single
 * weighted edge. The aggregated weight is the sum of individual weights.
 *
 * Used when total simulation count exceeds 50 to keep the graph readable.
 */
export interface InfluenceEdge {
  sourceNodeId: string;
  targetNodeId: string;
  weight: number;
  simulationId: string;
}

export interface AggregatedEdge {
  sourceNodeId: string;
  targetNodeId: string;
  weight: number;
  count: number;
}

export function aggregateInfluenceEdges(edges: InfluenceEdge[]): AggregatedEdge[] {
  const map = new Map<string, AggregatedEdge>();
  for (const edge of edges) {
    const key = `${edge.sourceNodeId}->${edge.targetNodeId}`;
    const existing = map.get(key);
    if (existing) {
      existing.weight += edge.weight;
      existing.count += 1;
    } else {
      map.set(key, {
        sourceNodeId: edge.sourceNodeId,
        targetNodeId: edge.targetNodeId,
        weight: edge.weight,
        count: 1,
      });
    }
  }
  return Array.from(map.values());
}
