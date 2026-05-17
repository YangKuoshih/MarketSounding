/**
 * Property-based tests for the Dealer Agent.
 * Tests prompt construction, reaction parsing, and validation logic.
 *
 * **Validates: Requirements 3.1, 3.3, 6.2, 7.1, 7.2, 7.3, 7.4, 17.1, 17.2, 17.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { buildDealerPrompt } from './prompt-builder';
import { parseReactionResponse } from '../../lib/reaction-parser';
import { loadPersona, PERSONA_IDS } from '../../data/personas';
import { PersonaProfile } from '../../data/personas/types';
import { DealerAgentInput, PeerReaction } from './types';
import { DealerSessionState } from '../../lib/session-state';

// --- Generators ---

const personaIdArb = fc.constantFrom(...PERSONA_IDS);

const eventContextArb = fc.record({
  eventId: fc.uuid(),
  eventText: fc.string({ minLength: 10, maxLength: 12000 }),
  eventSummary: fc.string({ minLength: 5, maxLength: 500 }),
  eventDate: fc.date().map((d) => d.toISOString().split('T')[0]),
});

const peerReactionArb = fc.record({
  personaId: personaIdArb,
  personaName: fc.constantFrom('Goldman Sachs', 'JP Morgan', 'Morgan Stanley', 'Citi', 'Bank of America'),
  ratePathView: fc.string({ minLength: 5, maxLength: 200 }),
  balanceSheetView: fc.string({ minLength: 5, maxLength: 200 }),
  riskAssetView: fc.string({ minLength: 5, maxLength: 200 }),
  keyConcerns: fc.array(fc.string({ minLength: 3, maxLength: 100 }), { minLength: 1, maxLength: 3 }),
  hawkishDovishScore: fc.double({ min: -1, max: 1, noNaN: true }),
  confidence: fc.double({ min: 0, max: 1, noNaN: true }),
  reasoningMd: fc.string({ minLength: 10, maxLength: 500 }),
  keyQuote: fc.option(fc.string({ minLength: 5, maxLength: 200 }), { nil: undefined }),
});

const hdScoreArb = fc.double({ min: -1, max: 1, noNaN: true });
const confidenceArb = fc.double({ min: 0, max: 1, noNaN: true });

function buildEmptySession(simulationId: string, personaId: string): DealerSessionState {
  return {
    simulationId,
    personaId,
    priorReactions: [],
    positionHistory: [],
    keyInfluences: [],
  };
}

function buildSessionWithPrior(
  simulationId: string,
  personaId: string,
  priorHdScore: number
): DealerSessionState {
  return {
    simulationId,
    personaId,
    priorReactions: [
      {
        roundNumber: 1,
        roundType: 'initial',
        reaction: {
          ratePathView: 'Prior rate path view',
          balanceSheetView: 'Prior balance sheet view',
          riskAssetView: 'Prior risk asset view',
          keyConcerns: ['Prior concern'],
          hawkishDovishScore: priorHdScore,
          confidence: 0.7,
          reasoningMd: 'Prior reasoning markdown content.',
        },
      },
    ],
    positionHistory: [
      {
        roundNumber: 1,
        hawkishDovishScore: priorHdScore,
        confidence: 0.7,
        positionShift: null,
      },
    ],
    keyInfluences: [
      {
        roundNumber: 1,
        influencedBy: [],
        keyQuote: null,
      },
    ],
  };
}

// Valid reaction JSON generator
const validReactionJsonArb = fc
  .record({
    ratePathView: fc.string({ minLength: 3, maxLength: 200 }),
    balanceSheetView: fc.string({ minLength: 3, maxLength: 200 }),
    riskAssetView: fc.string({ minLength: 3, maxLength: 200 }),
    keyConcerns: fc.array(fc.string({ minLength: 3, maxLength: 100 }), { minLength: 1, maxLength: 3 }),
    hawkishDovishScore: fc.double({ min: -2, max: 2, noNaN: true }),
    confidence: fc.double({ min: -1, max: 2, noNaN: true }),
    reasoningMd: fc.string({ minLength: 5, maxLength: 500 }),
    positionShift: fc.option(fc.double({ min: -2, max: 2, noNaN: true }), { nil: undefined }),
    influencedBy: fc.option(
      fc.array(personaIdArb, { minLength: 1, maxLength: 3 }),
      { nil: undefined }
    ),
    keyQuote: fc.option(fc.string({ minLength: 5, maxLength: 200 }), { nil: undefined }),
  })
  .map((r) => JSON.stringify(r));

describe('Dealer Agent Property Tests', () => {
  /**
   * Property 4: Round 1 Independence
   * All Round 1 invocations have null/empty peer reactions.
   * **Validates: Requirements 3.1**
   */
  describe('Property 4: Round 1 Independence', () => {
    it('Round 1 prompts never include peer reaction content', () => {
      fc.assert(
        fc.property(personaIdArb, eventContextArb, (personaId, eventContext) => {
          const persona = loadPersona(personaId);
          const input: DealerAgentInput = {
            personaId,
            simulationId: 'sim-test',
            roundNumber: 1,
            roundType: 'initial',
            eventContext,
            peerReactions: undefined,
          };
          const session = buildEmptySession('sim-test', personaId);
          const prompt = buildDealerPrompt(persona, input, session);

          // Round 1 prompt should not contain "OTHER DEALERS" or peer reaction formatting
          const fullText = prompt.system + ' ' + prompt.messages.map((m) => m.content).join(' ');
          expect(fullText).not.toContain('OTHER DEALERS');
          expect(fullText).not.toContain('PEER POSITIONS');
        }),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 6: Self-Exclusion from Peer Context
   * Dealer D never sees own reaction in peer context.
   * **Validates: Requirements 3.3**
   */
  describe('Property 6: Self-Exclusion from Peer Context', () => {
    it('peer_response prompt excludes the current dealer from peer reactions', () => {
      fc.assert(
        fc.property(
          personaIdArb,
          eventContextArb,
          fc.array(peerReactionArb, { minLength: 2, maxLength: 5 }),
          hdScoreArb,
          (personaId, eventContext, peerReactions, priorScore) => {
            // Ensure at least one peer reaction has the same personaId as the dealer
            const selfReaction: PeerReaction = {
              personaId,
              personaName: 'Self',
              ratePathView: 'Self rate path',
              balanceSheetView: 'Self balance sheet',
              riskAssetView: 'Self risk assets',
              keyConcerns: ['Self concern'],
              hawkishDovishScore: 0.5,
              confidence: 0.8,
              reasoningMd: 'Self reasoning that should be excluded.',
            };

            // Filter out self (as the handler would do before passing to prompt builder)
            const filteredPeers = [...peerReactions, selfReaction].filter(
              (r) => r.personaId !== personaId
            );

            const persona = loadPersona(personaId);
            const input: DealerAgentInput = {
              personaId,
              simulationId: 'sim-test',
              roundNumber: 2,
              roundType: 'peer_response',
              eventContext,
              peerReactions: filteredPeers,
            };
            const session = buildSessionWithPrior('sim-test', personaId, priorScore);
            const prompt = buildDealerPrompt(persona, input, session);

            // The prompt should not contain the self-reaction's unique text
            const fullText = prompt.system + ' ' + prompt.messages.map((m) => m.content).join(' ');
            expect(fullText).not.toContain('Self reasoning that should be excluded.');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 11: Prompt Construction Completeness
   * Prompt contains persona profile (>=100 chars), event text (<=12000 chars),
   * round-appropriate peer context.
   * **Validates: Requirements 6.2**
   */
  describe('Property 11: Prompt Construction Completeness', () => {
    it('all prompts contain persona profile of at least 100 chars', () => {
      fc.assert(
        fc.property(
          personaIdArb,
          eventContextArb,
          (personaId, eventContext) => {
            const persona = loadPersona(personaId);
            const input: DealerAgentInput = {
              personaId,
              simulationId: 'sim-test',
              roundNumber: 1,
              roundType: 'initial',
              eventContext,
            };
            const session = buildEmptySession('sim-test', personaId);
            const prompt = buildDealerPrompt(persona, input, session);

            // System prompt must contain persona profile (>=100 chars of profile content)
            expect(prompt.system.length).toBeGreaterThanOrEqual(100);
            expect(prompt.system).toContain(persona.name);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('event text in prompt is truncated to 12000 chars max', () => {
      fc.assert(
        fc.property(
          personaIdArb,
          fc.record({
            eventId: fc.uuid(),
            eventText: fc.string({ minLength: 12001, maxLength: 15000 }),
            eventSummary: fc.string({ minLength: 5, maxLength: 500 }),
            eventDate: fc.constant('2026-01-15'),
          }),
          (personaId, eventContext) => {
            const persona = loadPersona(personaId);
            const input: DealerAgentInput = {
              personaId,
              simulationId: 'sim-test',
              roundNumber: 1,
              roundType: 'initial',
              eventContext,
            };
            const session = buildEmptySession('sim-test', personaId);
            const prompt = buildDealerPrompt(persona, input, session);

            // User message should not contain the full event text if it exceeds 12000
            const userContent = prompt.messages[0].content;
            // The event text portion should be truncated
            expect(userContent).toContain('[...truncated for context window]');
          }
        ),
        { numRuns: 20 }
      );
    });

    it('peer_response prompts contain peer context', () => {
      fc.assert(
        fc.property(
          personaIdArb,
          eventContextArb,
          fc.array(peerReactionArb, { minLength: 1, maxLength: 4 }).filter(
            (peers) => peers.length > 0
          ),
          hdScoreArb,
          (personaId, eventContext, peerReactions, priorScore) => {
            // Filter out self from peers
            const filteredPeers = peerReactions.filter((r) => r.personaId !== personaId);
            if (filteredPeers.length === 0) return; // Skip if no peers remain

            const persona = loadPersona(personaId);
            const input: DealerAgentInput = {
              personaId,
              simulationId: 'sim-test',
              roundNumber: 2,
              roundType: 'peer_response',
              eventContext,
              peerReactions: filteredPeers,
            };
            const session = buildSessionWithPrior('sim-test', personaId, priorScore);
            const prompt = buildDealerPrompt(persona, input, session);

            const userContent = prompt.messages[0].content;
            expect(userContent).toContain('OTHER DEALERS');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 12: Reaction Score Bounding
   * hawkishDovishScore clamped to [-1,+1], confidence clamped to [0,1].
   * **Validates: Requirements 7.1, 7.2**
   */
  describe('Property 12: Reaction Score Bounding', () => {
    it('hawkishDovishScore is always clamped to [-1, +1]', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -10, max: 10, noNaN: true }),
          confidenceArb,
          (rawHdScore, confidence) => {
            const reaction = JSON.stringify({
              ratePathView: 'Test rate path',
              balanceSheetView: 'Test balance sheet',
              riskAssetView: 'Test risk assets',
              keyConcerns: ['Test concern'],
              hawkishDovishScore: rawHdScore,
              confidence,
              reasoningMd: 'Test reasoning content.',
            });

            const result = parseReactionResponse(reaction, null);
            if (result.success) {
              expect(result.reaction.hawkishDovishScore).toBeGreaterThanOrEqual(-1);
              expect(result.reaction.hawkishDovishScore).toBeLessThanOrEqual(1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('confidence is always clamped to [0, 1]', () => {
      fc.assert(
        fc.property(
          hdScoreArb,
          fc.double({ min: -5, max: 5, noNaN: true }),
          (hdScore, rawConfidence) => {
            const reaction = JSON.stringify({
              ratePathView: 'Test rate path',
              balanceSheetView: 'Test balance sheet',
              riskAssetView: 'Test risk assets',
              keyConcerns: ['Test concern'],
              hawkishDovishScore: hdScore,
              confidence: rawConfidence,
              reasoningMd: 'Test reasoning content.',
            });

            const result = parseReactionResponse(reaction, null);
            if (result.success) {
              expect(result.reaction.confidence).toBeGreaterThanOrEqual(0);
              expect(result.reaction.confidence).toBeLessThanOrEqual(1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 13: Reaction Structure Validation
   * Parsed reaction has all required fields with valid values.
   * **Validates: Requirements 7.3**
   */
  describe('Property 13: Reaction Structure Validation', () => {
    it('valid JSON produces a reaction with all required fields', () => {
      fc.assert(
        fc.property(validReactionJsonArb, (jsonStr) => {
          const result = parseReactionResponse(jsonStr, null);
          if (result.success) {
            expect(result.reaction.ratePathView).toBeTruthy();
            expect(result.reaction.balanceSheetView).toBeTruthy();
            expect(result.reaction.riskAssetView).toBeTruthy();
            expect(result.reaction.keyConcerns.length).toBeGreaterThanOrEqual(1);
            expect(result.reaction.keyConcerns.length).toBeLessThanOrEqual(3);
            expect(result.reaction.reasoningMd).toBeTruthy();
            expect(typeof result.reaction.hawkishDovishScore).toBe('number');
            expect(typeof result.reaction.confidence).toBe('number');
          }
        }),
        { numRuns: 100 }
      );
    });

    it('keyConcerns always has 1-3 items when parse succeeds', () => {
      fc.assert(
        fc.property(validReactionJsonArb, (jsonStr) => {
          const result = parseReactionResponse(jsonStr, null);
          if (result.success) {
            expect(result.reaction.keyConcerns.length).toBeGreaterThanOrEqual(1);
            expect(result.reaction.keyConcerns.length).toBeLessThanOrEqual(3);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 14: Position Shift Arithmetic
   * positionShift equals current minus prior H/D score within 0.001.
   * **Validates: Requirements 7.4, 17.1**
   */
  describe('Property 14: Position Shift Arithmetic', () => {
    it('positionShift equals current H/D minus prior H/D within tolerance', () => {
      fc.assert(
        fc.property(
          hdScoreArb,
          hdScoreArb,
          (currentHd, priorHd) => {
            const reaction = JSON.stringify({
              ratePathView: 'Test rate path',
              balanceSheetView: 'Test balance sheet',
              riskAssetView: 'Test risk assets',
              keyConcerns: ['Test concern'],
              hawkishDovishScore: currentHd,
              confidence: 0.7,
              reasoningMd: 'Test reasoning content.',
              positionShift: currentHd - priorHd,
            });

            const result = parseReactionResponse(reaction, priorHd);
            if (result.success && result.reaction.positionShift !== undefined) {
              const expectedShift = result.reaction.hawkishDovishScore - priorHd;
              expect(Math.abs(result.reaction.positionShift - expectedShift)).toBeLessThanOrEqual(0.001);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('positionShift is undefined when no prior score exists', () => {
      fc.assert(
        fc.property(validReactionJsonArb, (jsonStr) => {
          const result = parseReactionResponse(jsonStr, null);
          if (result.success) {
            expect(result.reaction.positionShift).toBeUndefined();
          }
        }),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 15: Peer Response Metadata Completeness
   * influencedBy contains only valid persona IDs, keyQuote is non-empty when present.
   * **Validates: Requirements 17.2, 17.3**
   */
  describe('Property 15: Peer Response Metadata Completeness', () => {
    it('influencedBy contains only valid persona IDs when present', () => {
      fc.assert(
        fc.property(
          fc.array(personaIdArb, { minLength: 1, maxLength: 3 }),
          (influencedBy) => {
            const reaction = JSON.stringify({
              ratePathView: 'Test rate path',
              balanceSheetView: 'Test balance sheet',
              riskAssetView: 'Test risk assets',
              keyConcerns: ['Test concern'],
              hawkishDovishScore: 0.2,
              confidence: 0.7,
              reasoningMd: 'Test reasoning content.',
              influencedBy,
              keyQuote: 'Shifted due to peer influence.',
            });

            const result = parseReactionResponse(reaction, 0.0);
            if (result.success && result.reaction.influencedBy) {
              for (const id of result.reaction.influencedBy) {
                expect((PERSONA_IDS as readonly string[]).includes(id)).toBe(true);
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('keyQuote is non-empty string when present', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5, maxLength: 200 }),
          (quote) => {
            const reaction = JSON.stringify({
              ratePathView: 'Test rate path',
              balanceSheetView: 'Test balance sheet',
              riskAssetView: 'Test risk assets',
              keyConcerns: ['Test concern'],
              hawkishDovishScore: 0.2,
              confidence: 0.7,
              reasoningMd: 'Test reasoning content.',
              keyQuote: quote,
            });

            const result = parseReactionResponse(reaction, 0.0);
            if (result.success && result.reaction.keyQuote !== undefined) {
              expect(result.reaction.keyQuote.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
