/**
 * Convergence detection for multi-round dealer simulations.
 * Calculates average absolute H/D score delta across all non-failed dealers.
 */

export interface ReactionScore {
  personaId: string;
  hawkishDovishScore: number;
  status: 'complete' | 'failed';
}

/**
 * Calculate convergence score between two rounds.
 * Returns the average absolute H/D score delta across all non-failed dealers.
 *
 * @param previousReactions - Reactions from the prior round
 * @param currentReactions - Reactions from the current round
 * @returns Convergence score (lower = more stable). Returns 1.0 if no valid comparison pairs exist.
 *
 * Preconditions:
 * - Both arrays contain reactions for the same set of persona IDs
 *
 * Postconditions:
 * - Returns value in [0, 2] range (max possible H/D shift is 2, from -1 to +1)
 * - Returns 1.0 if no valid comparison pairs exist (forces continuation)
 * - Lower values indicate more stable positions
 * - Excludes failed dealers from calculation
 */
export function calculateConvergence(
  previousReactions: ReactionScore[],
  currentReactions: ReactionScore[]
): number {
  let totalShift = 0;
  let count = 0;

  for (const current of currentReactions) {
    if (current.status === 'failed') continue;

    const previous = previousReactions.find((r) => r.personaId === current.personaId);
    if (!previous || previous.status === 'failed') continue;

    const shift = Math.abs(current.hawkishDovishScore - previous.hawkishDovishScore);
    totalShift += shift;
    count++;
  }

  return count > 0 ? totalShift / count : 1.0;
}
