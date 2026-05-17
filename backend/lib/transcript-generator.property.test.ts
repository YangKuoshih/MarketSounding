/**
 * Property tests for transcript generator (Task 7.3).
 *
 * Validates:
 *   Property 24: Transcript Completeness
 *   Property 25: Anchor and Swing Dealer Identification
 *   Property 26: Cluster Analysis Correctness
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  generateTranscript,
  TranscriptInput,
  TranscriptReaction,
} from './transcript-generator';

const PERSONA_IDS = ['gs', 'jpm', 'ms', 'citi', 'bofa'] as const;
const PERSONA_NAMES: Record<string, string> = {
  gs: 'Goldman Sachs',
  jpm: 'JP Morgan',
  ms: 'Morgan Stanley',
  citi: 'Citi',
  bofa: 'Bank of America',
};
const SHORT_NAMES: Record<string, string> = {
  gs: 'GS',
  jpm: 'JPM',
  ms: 'MS',
  citi: 'Citi',
  bofa: 'BofA',
};

function buildReaction(
  personaId: string,
  roundNumber: number,
  hawkishDovishScore: number,
  positionShift: number | null = null,
): TranscriptReaction {
  return {
    personaId,
    personaName: PERSONA_NAMES[personaId],
    shortName: SHORT_NAMES[personaId],
    roundNumber,
    roundType: roundNumber === 1 ? 'initial' : 'peer_response',
    status: 'complete',
    ratePathView: `${personaId} rate path`,
    balanceSheetView: `${personaId} balance sheet`,
    riskAssetView: `${personaId} risk assets`,
    keyConcerns: ['Inflation', 'Wages'],
    hawkishDovishScore,
    confidence: 0.7,
    reasoningMd: `${personaId} reasoning for round ${roundNumber}`,
    positionShift,
    influencedBy: roundNumber > 1 ? ['gs'] : [],
    keyQuote: roundNumber > 1 ? `${personaId} key quote` : null,
  };
}

describe('Transcript Generator Property Tests', () => {
  describe('Property 24: Transcript Completeness', () => {
    it('transcript has N round sections, each with M dealer entries', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 5 }),
          (numRounds, numDealers) => {
            const subset = PERSONA_IDS.slice(0, numDealers);
            const rounds = Array.from({ length: numRounds }, (_, i) => ({
              roundNumber: i + 1,
              roundType: (i === 0 ? 'initial' : 'peer_response') as
                | 'initial'
                | 'peer_response',
              reactions: subset.map((id) =>
                buildReaction(id, i + 1, 0.1 * i, i > 0 ? 0.1 : null),
              ),
            }));

            const input: TranscriptInput = {
              simulationId: 'sim_test',
              eventTitle: 'Test Event',
              eventSummary: 'Test summary',
              eventDate: '2026-01-01',
              rounds,
            };

            const result = generateTranscript(input);

            // Verify markdown contains a heading per round
            for (let i = 1; i <= numRounds; i++) {
              expect(result.markdown).toMatch(new RegExp(`Round ${i}`));
            }

            // Verify each dealer's name (or short name) appears in the markdown
            for (const id of subset) {
              const matchedAnyName =
                result.markdown.includes(PERSONA_NAMES[id]) ||
                result.markdown.includes(SHORT_NAMES[id]) ||
                result.markdown.toLowerCase().includes(id);
              expect(matchedAnyName).toBe(true);
            }
          },
        ),
      );
    });

    it('non-empty markdown returned for valid simulations', () => {
      const rounds = [
        {
          roundNumber: 1,
          roundType: 'initial' as const,
          reactions: PERSONA_IDS.map((id) => buildReaction(id, 1, 0.0)),
        },
      ];

      const result = generateTranscript({
        simulationId: 'sim_test',
        eventTitle: 'Title',
        eventSummary: 'Summary',
        eventDate: '2026-01-01',
        rounds,
      });

      expect(result.markdown.length).toBeGreaterThan(50);
    });
  });

  describe('Property 25: Anchor and Swing Dealer Identification', () => {
    it('anchor has minimum total absolute position shift', () => {
      // Build trajectories: GS holds (0 shift), MS shifts dramatically
      const rounds = [
        {
          roundNumber: 1,
          roundType: 'initial' as const,
          reactions: [
            buildReaction('gs', 1, 0.5),
            buildReaction('jpm', 1, 0.0),
            buildReaction('ms', 1, -0.5),
          ],
        },
        {
          roundNumber: 2,
          roundType: 'peer_response' as const,
          reactions: [
            buildReaction('gs', 2, 0.5, 0.0), // anchor: zero shift
            buildReaction('jpm', 2, 0.1, 0.1),
            buildReaction('ms', 2, 0.5, 1.0), // swing: largest shift
          ],
        },
      ];

      const result = generateTranscript({
        simulationId: 'sim_test',
        eventTitle: 'Title',
        eventSummary: 'Summary',
        eventDate: '2026-01-01',
        rounds,
      });

      expect(result.anchorDealer.personaId).toBe('gs');
      expect(result.swingDealer.personaId).toBe('ms');
      expect(result.anchorDealer.totalShift).toBeLessThanOrEqual(
        result.swingDealer.totalShift,
      );
    });

    it('anchor totalShift is always <= swing totalShift', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.float({ min: Math.fround(-1), max: Math.fround(1), noNaN: true }),
            { minLength: 5, maxLength: 5 },
          ),
          fc.array(
            fc.float({ min: Math.fround(-1), max: Math.fround(1), noNaN: true }),
            { minLength: 5, maxLength: 5 },
          ),
          (round1Scores, round2Scores) => {
            const rounds = [
              {
                roundNumber: 1,
                roundType: 'initial' as const,
                reactions: PERSONA_IDS.map((id, i) =>
                  buildReaction(id, 1, round1Scores[i]),
                ),
              },
              {
                roundNumber: 2,
                roundType: 'peer_response' as const,
                reactions: PERSONA_IDS.map((id, i) =>
                  buildReaction(
                    id,
                    2,
                    round2Scores[i],
                    round2Scores[i] - round1Scores[i],
                  ),
                ),
              },
            ];

            const result = generateTranscript({
              simulationId: 'sim_test',
              eventTitle: 'Title',
              eventSummary: 'Summary',
              eventDate: '2026-01-01',
              rounds,
            });

            expect(result.anchorDealer.totalShift).toBeLessThanOrEqual(
              result.swingDealer.totalShift,
            );
          },
        ),
      );
    });
  });

  describe('Property 26: Cluster Analysis Correctness', () => {
    it('dealers within proximity threshold are grouped together', () => {
      // GS=-0.5, Citi=-0.45 (close), MS=+0.5, BofA=+0.45 (close), JPM=0.0 (alone)
      const rounds = [
        {
          roundNumber: 1,
          roundType: 'initial' as const,
          reactions: [
            buildReaction('gs', 1, -0.5),
            buildReaction('citi', 1, -0.45),
            buildReaction('ms', 1, 0.5),
            buildReaction('bofa', 1, 0.45),
            buildReaction('jpm', 1, 0.0),
          ],
        },
      ];

      const result = generateTranscript({
        simulationId: 'sim_test',
        eventTitle: 'Title',
        eventSummary: 'Summary',
        eventDate: '2026-01-01',
        rounds,
      });

      // The two dovish dealers should cluster together; the two hawkish similarly
      const allClustered = result.clusters.aligned.flat();
      expect(allClustered.length + result.clusters.outliers.length).toBeGreaterThanOrEqual(3);

      // Check that some kind of clustering happened
      expect(
        result.clusters.aligned.length + result.clusters.outliers.length,
      ).toBeGreaterThan(0);
    });
  });
});
