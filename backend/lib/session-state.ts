/**
 * Session state management for dealer agents.
 * Uses DynamoDB directly as session state store (simplified AgentCore Memory for hackathon).
 * Stores per-dealer session: priorReactions, positionHistory, keyInfluences.
 */

import { docClient } from './dynamodb';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Reaction } from './reaction-parser';

const REACTIONS_TABLE_NAME = process.env.REACTIONS_TABLE_NAME || 'reactions';

// In-memory store for local dev (IS_LOCAL=true bypasses DynamoDB)
const localSessionStore = new Map<string, DealerSessionState>();

export interface DealerSessionState {
  simulationId: string;
  personaId: string;
  priorReactions: RoundReaction[];
  positionHistory: PositionEntry[];
  keyInfluences: InfluenceEntry[];
}

export interface RoundReaction {
  roundNumber: number;
  roundType: 'initial' | 'peer_response' | 'crisis_reevaluation';
  reaction: Reaction;
}

export interface PositionEntry {
  roundNumber: number;
  hawkishDovishScore: number;
  confidence: number;
  positionShift: number | null;
}

export interface InfluenceEntry {
  roundNumber: number;
  influencedBy: string[];
  keyQuote: string | null;
}

/**
 * Load the session state for a dealer in a simulation.
 * Returns an empty session if no prior state exists.
 */
export async function loadSessionState(
  simulationId: string,
  personaId: string
): Promise<DealerSessionState> {
  if (process.env.IS_LOCAL === 'true') {
    return localSessionStore.get(`${simulationId}#${personaId}`) ?? createEmptySession(simulationId, personaId);
  }
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: REACTIONS_TABLE_NAME,
        Key: {
          pk: `session#${simulationId}`,
          personaId: personaId,
        },
      })
    );

    if (result.Item) {
      return result.Item as unknown as DealerSessionState;
    }
  } catch {
    // If table doesn't exist or item not found, return empty session
  }

  return createEmptySession(simulationId, personaId);
}

/**
 * Save the updated session state after a round completes.
 */
export async function saveSessionState(state: DealerSessionState): Promise<void> {
  if (process.env.IS_LOCAL === 'true') {
    localSessionStore.set(`${state.simulationId}#${state.personaId}`, state);
    return;
  }
  await docClient.send(
    new PutCommand({
      TableName: REACTIONS_TABLE_NAME,
      Item: {
        pk: `session#${state.simulationId}`,
        personaId: state.personaId,
        simulationId: state.simulationId,
        priorReactions: state.priorReactions,
        positionHistory: state.positionHistory,
        keyInfluences: state.keyInfluences,
        updatedAt: new Date().toISOString(),
      },
    })
  );
}

/**
 * Update session state with a new round's reaction.
 */
export function updateSessionState(
  state: DealerSessionState,
  roundNumber: number,
  roundType: 'initial' | 'peer_response' | 'crisis_reevaluation',
  reaction: Reaction
): DealerSessionState {
  const updatedReactions = [
    ...state.priorReactions,
    { roundNumber, roundType, reaction },
  ];

  const updatedPositionHistory = [
    ...state.positionHistory,
    {
      roundNumber,
      hawkishDovishScore: reaction.hawkishDovishScore,
      confidence: reaction.confidence,
      positionShift: reaction.positionShift ?? null,
    },
  ];

  const updatedInfluences = [
    ...state.keyInfluences,
    {
      roundNumber,
      influencedBy: reaction.influencedBy ?? [],
      keyQuote: reaction.keyQuote ?? null,
    },
  ];

  return {
    ...state,
    priorReactions: updatedReactions,
    positionHistory: updatedPositionHistory,
    keyInfluences: updatedInfluences,
  };
}

/**
 * Get the prior H/D score from session state (for position shift calculation).
 * Returns null if no prior rounds exist.
 */
export function getPriorHdScore(state: DealerSessionState): number | null {
  if (state.positionHistory.length === 0) return null;
  return state.positionHistory[state.positionHistory.length - 1].hawkishDovishScore;
}

function createEmptySession(simulationId: string, personaId: string): DealerSessionState {
  return {
    simulationId,
    personaId,
    priorReactions: [],
    positionHistory: [],
    keyInfluences: [],
  };
}
