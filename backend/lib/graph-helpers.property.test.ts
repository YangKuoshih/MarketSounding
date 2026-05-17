/**
 * Property tests for graph helpers (Task 7.3).
 *
 * Validates:
 *   Property 20: Graph Extraction and Correlation Threshold
 *   Property 21: Edge Aggregation
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  normalizeConcern,
  classifyConcern,
  computeJaccardSimilarity,
  shouldCreateCorrelationEdge,
  aggregateInfluenceEdges,
  InfluenceEdge,
} from './graph-helpers';

describe('Graph Helpers Property Tests', () => {
  describe('normalizeConcern', () => {
    it('produces lowercase kebab-case output', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 50 }), (raw) => {
          const result = normalizeConcern(raw);
          // Output is always lowercase
          expect(result).toBe(result.toLowerCase());
          // No spaces (replaced with -)
          expect(result).not.toMatch(/\s/);
          // Only [a-z0-9-] characters
          expect(result).toMatch(/^[a-z0-9-]*$/);
        }),
      );
    });

    it('common examples normalize correctly', () => {
      expect(normalizeConcern('Wage Growth')).toBe('wage-growth');
      expect(normalizeConcern('Core PCE')).toBe('core-pce');
      expect(normalizeConcern('  Inflation!  ')).toBe('inflation');
    });
  });

  describe('classifyConcern', () => {
    it('always returns one of 4 categories', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 100 }), (raw) => {
          const cat = classifyConcern(raw);
          expect(['macro', 'market', 'geopolitical', 'policy']).toContain(cat);
        }),
      );
    });

    it('macro keywords classify correctly', () => {
      expect(classifyConcern('inflation pressure')).toBe('macro');
      expect(classifyConcern('rate path')).toBe('macro');
      expect(classifyConcern('wage growth')).toBe('macro');
    });

    it('market keywords classify correctly', () => {
      expect(classifyConcern('equity volatility')).toBe('market');
      expect(classifyConcern('credit spread')).toBe('market');
    });

    it('geopolitical keywords classify correctly', () => {
      expect(classifyConcern('tariff war')).toBe('geopolitical');
      expect(classifyConcern('oil supply shock')).toBe('geopolitical');
    });

    it('unknown concerns default to policy', () => {
      expect(classifyConcern('regulatory framework')).toBe('policy');
    });
  });

  describe('computeJaccardSimilarity', () => {
    it('result is always in [0, 1]', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string(), { maxLength: 20 }),
          fc.array(fc.string(), { maxLength: 20 }),
          (a, b) => {
            const result = computeJaccardSimilarity(new Set(a), new Set(b));
            expect(result).toBeGreaterThanOrEqual(0);
            expect(result).toBeLessThanOrEqual(1);
          },
        ),
      );
    });

    it('identical sets have similarity 1', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string(), { minLength: 1, maxLength: 20 }),
          (items) => {
            const a = new Set(items);
            const b = new Set(items);
            if (a.size === 0) return; // skip empty
            expect(computeJaccardSimilarity(a, b)).toBe(1);
          },
        ),
      );
    });

    it('disjoint sets have similarity 0', () => {
      const a = new Set(['x', 'y', 'z']);
      const b = new Set(['p', 'q', 'r']);
      expect(computeJaccardSimilarity(a, b)).toBe(0);
    });

    it('partial overlap matches expected ratio', () => {
      // {a, b, c} ∩ {b, c, d} = {b, c} (size 2)
      // {a, b, c} ∪ {b, c, d} = {a, b, c, d} (size 4)
      // J = 2/4 = 0.5
      const a = new Set(['a', 'b', 'c']);
      const b = new Set(['b', 'c', 'd']);
      expect(computeJaccardSimilarity(a, b)).toBe(0.5);
    });

    it('symmetric: J(A, B) === J(B, A)', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string(), { maxLength: 10 }),
          fc.array(fc.string(), { maxLength: 10 }),
          (a, b) => {
            const setA = new Set(a);
            const setB = new Set(b);
            expect(computeJaccardSimilarity(setA, setB)).toBeCloseTo(
              computeJaccardSimilarity(setB, setA),
              10,
            );
          },
        ),
      );
    });
  });

  describe('Property 20: Correlation Threshold', () => {
    it('correlation edge created iff Jaccard > 0.3', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string(), { maxLength: 10 }),
          fc.array(fc.string(), { maxLength: 10 }),
          (a, b) => {
            const setA = new Set(a);
            const setB = new Set(b);
            const similarity = computeJaccardSimilarity(setA, setB);
            const shouldCreate = shouldCreateCorrelationEdge(setA, setB);

            if (similarity > 0.3) {
              expect(shouldCreate).toBe(true);
            } else {
              expect(shouldCreate).toBe(false);
            }
          },
        ),
      );
    });

    it('Jaccard = 0.3 exactly does not create edge (strictly greater)', () => {
      // |A ∩ B| = 3, |A ∪ B| = 10  ->  J = 0.3
      const a = new Set(['a', 'b', 'c', 'x', 'y', 'z', 'p']);
      const b = new Set(['a', 'b', 'c', 'q', 'r', 's']);
      // |A ∩ B| = 3, |A ∪ B| = 10
      const sim = computeJaccardSimilarity(a, b);
      expect(sim).toBe(0.3);
      expect(shouldCreateCorrelationEdge(a, b)).toBe(false);
    });
  });

  describe('Property 21: Edge Aggregation', () => {
    it('parallel edges between same dealer pair sum to a single weighted edge', () => {
      const edges: InfluenceEdge[] = [
        { sourceNodeId: 'gs', targetNodeId: 'jpm', weight: 0.3, simulationId: 's1' },
        { sourceNodeId: 'gs', targetNodeId: 'jpm', weight: 0.5, simulationId: 's2' },
        { sourceNodeId: 'gs', targetNodeId: 'jpm', weight: 0.2, simulationId: 's3' },
        { sourceNodeId: 'ms', targetNodeId: 'bofa', weight: 0.4, simulationId: 's1' },
      ];

      const aggregated = aggregateInfluenceEdges(edges);
      expect(aggregated.length).toBe(2);

      const gsToJpm = aggregated.find(
        (e) => e.sourceNodeId === 'gs' && e.targetNodeId === 'jpm',
      );
      expect(gsToJpm?.weight).toBeCloseTo(1.0, 5);
      expect(gsToJpm?.count).toBe(3);

      const msToBofa = aggregated.find(
        (e) => e.sourceNodeId === 'ms' && e.targetNodeId === 'bofa',
      );
      expect(msToBofa?.weight).toBeCloseTo(0.4, 5);
      expect(msToBofa?.count).toBe(1);
    });

    it('total weight is preserved across aggregation', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              sourceNodeId: fc.constantFrom('gs', 'jpm', 'ms', 'citi', 'bofa'),
              targetNodeId: fc.constantFrom('gs', 'jpm', 'ms', 'citi', 'bofa'),
              weight: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
              simulationId: fc.string({ minLength: 1, maxLength: 10 }),
            }),
            { maxLength: 50 },
          ),
          (edges) => {
            const totalBefore = edges.reduce((sum, e) => sum + e.weight, 0);
            const aggregated = aggregateInfluenceEdges(edges);
            const totalAfter = aggregated.reduce((sum, e) => sum + e.weight, 0);
            expect(totalAfter).toBeCloseTo(totalBefore, 4);
          },
        ),
      );
    });

    it('aggregated edge count equals number of unique dealer pairs', () => {
      const edges: InfluenceEdge[] = [
        { sourceNodeId: 'gs', targetNodeId: 'jpm', weight: 0.1, simulationId: 's1' },
        { sourceNodeId: 'gs', targetNodeId: 'jpm', weight: 0.2, simulationId: 's2' },
        { sourceNodeId: 'gs', targetNodeId: 'ms', weight: 0.3, simulationId: 's1' },
      ];

      const aggregated = aggregateInfluenceEdges(edges);
      expect(aggregated.length).toBe(2); // gs->jpm and gs->ms
    });
  });
});
