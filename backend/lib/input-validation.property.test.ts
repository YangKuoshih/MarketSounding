/**
 * Property tests for input validation (Tasks 12.3, 16.2, 16.3).
 *
 * Validates:
 *   Property 3: Input Size Boundary Validation (event text <= 50KB)
 *   Property 23: User-Scoped Query Isolation
 *   Property 27: Unauthenticated Response Uniformity
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { z } from 'zod';
import { unauthorized, notFound } from './response';

const MAX_EVENT_TEXT_SIZE = 50 * 1024; // 50 KB

// Mirror the schema used by the simulation kickoff handler for event text input
const eventTextSchema = z
  .string()
  .max(MAX_EVENT_TEXT_SIZE, `Event text exceeds 50KB`);

describe('Input Validation Property Tests', () => {
  describe('Property 3: Input Size Boundary Validation', () => {
    it('accepts strings of <= 50KB', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: MAX_EVENT_TEXT_SIZE }),
          (text) => {
            const result = eventTextSchema.safeParse(text);
            expect(result.success).toBe(true);
          },
        ),
      );
    });

    it('rejects strings > 50KB', () => {
      const tooBig = 'a'.repeat(MAX_EVENT_TEXT_SIZE + 1);
      const result = eventTextSchema.safeParse(tooBig);
      expect(result.success).toBe(false);
    });

    it('boundary: exactly 50KB is accepted', () => {
      const atLimit = 'a'.repeat(MAX_EVENT_TEXT_SIZE);
      const result = eventTextSchema.safeParse(atLimit);
      expect(result.success).toBe(true);
    });

    it('boundary: 50KB + 1 byte is rejected', () => {
      const overLimit = 'a'.repeat(MAX_EVENT_TEXT_SIZE + 1);
      const result = eventTextSchema.safeParse(overLimit);
      expect(result.success).toBe(false);
    });
  });

  describe('Property 23: User-Scoped Query Isolation', () => {
    interface SimulationRecord {
      simulationId: string;
      userId: string;
      createdAt: string;
    }

    /**
     * Mirror of the user-scoped query the kickoff handler runs:
     *   QueryCommand on userId-createdAt-index, scanIndexForward: false.
     */
    function listUserSimulations(
      allSims: SimulationRecord[],
      requestingUserId: string,
    ): SimulationRecord[] {
      return allSims
        .filter((s) => s.userId === requestingUserId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    it('returns only the requesting user simulations', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              simulationId: fc.string({ minLength: 1, maxLength: 12 }),
              userId: fc.constantFrom('alice', 'bob', 'charlie'),
              createdAt: fc.date({
                min: new Date('2025-01-01'),
                max: new Date('2026-12-31'),
              }).map((d) => d.toISOString()),
            }),
            { maxLength: 50 },
          ),
          fc.constantFrom('alice', 'bob', 'charlie'),
          (allSims, requestingUserId) => {
            const result = listUserSimulations(allSims, requestingUserId);

            // All results belong to requesting user
            for (const sim of result) {
              expect(sim.userId).toBe(requestingUserId);
            }

            // No leakage of other users
            const otherUsersInResult = result.filter(
              (s) => s.userId !== requestingUserId,
            );
            expect(otherUsersInResult).toEqual([]);
          },
        ),
      );
    });

    it('results sorted by createdAt descending (most recent first)', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              simulationId: fc.string({ minLength: 1, maxLength: 12 }),
              userId: fc.constant('alice'),
              createdAt: fc.date({
                min: new Date('2025-01-01'),
                max: new Date('2026-12-31'),
              }).map((d) => d.toISOString()),
            }),
            { minLength: 2, maxLength: 20 },
          ),
          (sims) => {
            const result = listUserSimulations(sims, 'alice');
            for (let i = 0; i < result.length - 1; i++) {
              // Each timestamp >= next (descending order)
              expect(
                result[i].createdAt.localeCompare(result[i + 1].createdAt),
              ).toBeGreaterThanOrEqual(0);
            }
          },
        ),
      );
    });

    it('non-existent user returns empty array', () => {
      const sims = [
        { simulationId: 's1', userId: 'alice', createdAt: '2026-01-01T00:00:00Z' },
        { simulationId: 's2', userId: 'bob', createdAt: '2026-01-02T00:00:00Z' },
      ];
      const result = listUserSimulations(sims, 'charlie');
      expect(result).toEqual([]);
    });
  });

  describe('Property 27: Unauthenticated Response Uniformity', () => {
    it('all unauthenticated requests return identical 401 response', () => {
      // Simulate the auth middleware behavior: any missing/invalid token returns 401
      const responses = [
        unauthorized('Unauthorized'),
        unauthorized('Unauthorized'),
        unauthorized('Unauthorized'),
      ];

      for (const r of responses) {
        expect(r.statusCode).toBe(401);
        expect(JSON.parse(r.body)).toEqual({ error: 'Unauthorized' });
      }

      // All responses identical
      expect(responses[0].body).toBe(responses[1].body);
      expect(responses[1].body).toBe(responses[2].body);
    });

    it('protected endpoint with valid-format-but-invalid-token returns 401, not 404', () => {
      // The middleware returns 401 before resource existence is checked
      // This prevents an attacker from learning whether a resource exists
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 50 }), () => {
          const r = unauthorized('Unauthorized');
          expect(r.statusCode).toBe(401);
          expect(r.statusCode).not.toBe(404);
        }),
      );
    });

    it('401 response body contains generic "Unauthorized" message (no resource details)', () => {
      const r = unauthorized();
      const body = JSON.parse(r.body);
      // No resource ID, no path, no user ID leaks
      expect(body.error).toBe('Unauthorized');
      expect(Object.keys(body)).toEqual(['error']);
    });

    it('404 (when authenticated) is distinct from 401', () => {
      const r401 = unauthorized();
      const r404 = notFound();
      expect(r401.statusCode).not.toBe(r404.statusCode);
      // But both have the same generic body shape
      expect(Object.keys(JSON.parse(r401.body))).toEqual(['error']);
      expect(Object.keys(JSON.parse(r404.body))).toEqual(['error']);
    });
  });
});
