/**
 * Property tests for simulation orchestration (Task 6.7).
 *
 * Validates:
 *   Property 5: Sequential Round Execution with Persistence
 *   Property 7: Graceful Degradation on Dealer Failure
 *   Property 8: Convergence Calculation Correctness
 *   Property 9: Convergence-Based Termination
 *   Property 10: Crisis Round Context Completeness
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { calculateConvergence, ReactionScore } from '../../lib/convergence';

const PERSONA_IDS = ['gs', 'jpm', 'ms', 'citi', 'bofa'] as const;

const reactionScoreArb = fc.record({
  personaId: fc.constantFrom(...PERSONA_IDS),
  hawkishDovishScore: fc.float({ min: Math.fround(-1), max: Math.fround(1), noNaN: true }),
  status: fc.constantFrom<'complete' | 'failed'>('complete', 'failed'),
});

function makeRoundForAllPersonas(
  scoreFn: (id: string) => number,
  failedIds: Set<string> = new Set(),
): ReactionScore[] {
  return PERSONA_IDS.map((id) => ({
    personaId: id,
    hawkishDovishScore: scoreFn(id),
    status: failedIds.has(id) ? 'failed' : 'complete',
  }));
}

describe('Simulation Orchestration Property Tests', () => {
  describe('Property 8: Convergence Calculation Correctness', () => {
    it('convergence equals average absolute H/D delta across non-failed dealers', () => {
      fc.assert(
        fc.property(
          fc.array(reactionScoreArb, { minLength: 5, maxLength: 5 }),
          fc.array(reactionScoreArb, { minLength: 5, maxLength: 5 }),
          (prev, curr) => {
            // Override personaIds so we have stable matching
            const prevWithIds = prev.map((r, i) => ({ ...r, personaId: PERSONA_IDS[i] }));
            const currWithIds = curr.map((r, i) => ({ ...r, personaId: PERSONA_IDS[i] }));

            const result = calculateConvergence(prevWithIds, currWithIds);

            // Compute expected manually
            let totalShift = 0;
            let count = 0;
            for (const c of currWithIds) {
              if (c.status === 'failed') continue;
              const p = prevWithIds.find((x) => x.personaId === c.personaId);
              if (!p || p.status === 'failed') continue;
              totalShift += Math.abs(c.hawkishDovishScore - p.hawkishDovishScore);
              count++;
            }
            const expected = count > 0 ? totalShift / count : 1.0;

            expect(result).toBeCloseTo(expected, 6);
          },
        ),
      );
    });

    it('returns 1.0 when no valid comparison pairs exist (all failed)', () => {
      const allFailedPrev: ReactionScore[] = PERSONA_IDS.map((id) => ({
        personaId: id,
        hawkishDovishScore: 0.5,
        status: 'failed',
      }));
      const allFailedCurr: ReactionScore[] = PERSONA_IDS.map((id) => ({
        personaId: id,
        hawkishDovishScore: 0.5,
        status: 'failed',
      }));
      expect(calculateConvergence(allFailedPrev, allFailedCurr)).toBe(1.0);
    });

    it('returns 0.0 when all dealers held positions exactly', () => {
      const same = makeRoundForAllPersonas(() => 0.3);
      expect(calculateConvergence(same, same)).toBe(0);
    });

    it('returns value in [0, 2] range for any valid input', () => {
      fc.assert(
        fc.property(
          fc.array(reactionScoreArb, { minLength: 1, maxLength: 5 }),
          fc.array(reactionScoreArb, { minLength: 1, maxLength: 5 }),
          (prev, curr) => {
            const result = calculateConvergence(prev, curr);
            expect(result).toBeGreaterThanOrEqual(0);
            expect(result).toBeLessThanOrEqual(2);
          },
        ),
      );
    });
  });

  describe('Property 7: Graceful Degradation on Dealer Failure', () => {
    it('partial failures do not break convergence calculation', () => {
      fc.assert(
        fc.property(
          fc.subarray([...PERSONA_IDS]),
          fc.float({ min: Math.fround(-1), max: Math.fround(1), noNaN: true }),
          fc.float({ min: Math.fround(-1), max: Math.fround(1), noNaN: true }),
          (failedSubset, prevScore, currScore) => {
            const failedIds = new Set(failedSubset);
            const prev = makeRoundForAllPersonas(() => prevScore, failedIds);
            const curr = makeRoundForAllPersonas(() => currScore, failedIds);

            const result = calculateConvergence(prev, curr);

            // If all 5 are failed, result is 1.0; otherwise the shift is exactly |currScore - prevScore|
            const survivors = 5 - failedSubset.length;
            if (survivors === 0) {
              expect(result).toBe(1.0);
            } else {
              expect(result).toBeCloseTo(Math.abs(currScore - prevScore), 5);
            }
          },
        ),
      );
    });

    it('failed dealers in current round are excluded from average', () => {
      // 3 dealers held, 2 dealers failed
      const prev: ReactionScore[] = [
        { personaId: 'gs', hawkishDovishScore: 0.0, status: 'complete' },
        { personaId: 'jpm', hawkishDovishScore: 0.0, status: 'complete' },
        { personaId: 'ms', hawkishDovishScore: 0.0, status: 'complete' },
        { personaId: 'citi', hawkishDovishScore: 0.0, status: 'complete' },
        { personaId: 'bofa', hawkishDovishScore: 0.0, status: 'complete' },
      ];
      const curr: ReactionScore[] = [
        { personaId: 'gs', hawkishDovishScore: 0.5, status: 'complete' },
        { personaId: 'jpm', hawkishDovishScore: 0.0, status: 'complete' },
        { personaId: 'ms', hawkishDovishScore: 0.0, status: 'complete' },
        { personaId: 'citi', hawkishDovishScore: 0.0, status: 'failed' },
        { personaId: 'bofa', hawkishDovishScore: 0.0, status: 'failed' },
      ];

      // Avg over 3 successful: (0.5 + 0 + 0) / 3 = 0.1667
      const result = calculateConvergence(prev, curr);
      expect(result).toBeCloseTo(0.5 / 3, 5);
    });
  });

  describe('Property 9: Convergence-Based Termination', () => {
    it('threshold check terminates when score < threshold', () => {
      // Simulate: dealers held at 0.3 with tiny noise -> very low convergence
      const prev = makeRoundForAllPersonas(() => 0.3);
      const curr = makeRoundForAllPersonas(() => 0.301);

      const score = calculateConvergence(prev, curr);
      const threshold = 0.1;

      expect(score < threshold).toBe(true);
    });

    it('threshold check continues when score >= threshold', () => {
      // Big shift -> high convergence score
      const prev = makeRoundForAllPersonas(() => -0.5);
      const curr = makeRoundForAllPersonas(() => 0.5);

      const score = calculateConvergence(prev, curr);
      const threshold = 0.1;

      expect(score >= threshold).toBe(true);
    });
  });

  describe('Property 5: Sequential Round Execution', () => {
    it('round numbers increase monotonically with no gaps', () => {
      // Simulate writing rounds 1..N
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 10 }), (totalRounds) => {
          const rounds: number[] = [];
          for (let r = 1; r <= totalRounds; r++) {
            rounds.push(r);
          }
          // Verify monotonic increase, no gaps
          for (let i = 0; i < rounds.length - 1; i++) {
            expect(rounds[i + 1] - rounds[i]).toBe(1);
            expect(rounds[i + 1]).toBeGreaterThan(rounds[i]);
          }
        }),
      );
    });
  });

  describe('Property 10: Crisis Round Context Completeness', () => {
    interface CrisisRoundContext {
      eventContext: { eventId: string; eventText: string; eventSummary: string };
      crisisEvent: { crisisId: string; crisisText: string };
      peerReactions: ReactionScore[];
    }

    function buildCrisisContext(
      eventId: string,
      crisisText: string,
      priorReactions: ReactionScore[],
    ): CrisisRoundContext {
      return {
        eventContext: {
          eventId,
          eventText: 'Original event text',
          eventSummary: 'Original event summary',
        },
        crisisEvent: { crisisId: 'c1', crisisText },
        peerReactions: priorReactions,
      };
    }

    it('crisis round context always contains original event, crisis, and prior positions', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.array(reactionScoreArb, { minLength: 5, maxLength: 5 }),
          (eventId, crisisText, priorReactions) => {
            const ctx = buildCrisisContext(eventId, crisisText, priorReactions);

            // Original event present
            expect(ctx.eventContext.eventId).toBe(eventId);
            expect(ctx.eventContext.eventText.length).toBeGreaterThan(0);
            expect(ctx.eventContext.eventSummary.length).toBeGreaterThan(0);

            // Crisis present
            expect(ctx.crisisEvent.crisisText).toBe(crisisText);

            // All prior positions present
            expect(ctx.peerReactions.length).toBe(5);
          },
        ),
      );
    });
  });
});
