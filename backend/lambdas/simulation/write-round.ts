/**
 * Write Round Lambda (Step Functions task)
 * Invoked after each round's Map state completes.
 * Writes round record to `rounds` table and each reaction to `reactions` table.
 * Updates simulation record with currentRound progress.
 * Calculates convergence score and returns it.
 * Also handles Task Token registration for crisis injection.
 */

import { PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../lib/dynamodb';
import { calculateConvergence, ReactionScore } from '../../lib/convergence';

const SIMULATIONS_TABLE_NAME = process.env.SIMULATIONS_TABLE_NAME || 'simulations';
const ROUNDS_TABLE_NAME = process.env.ROUNDS_TABLE_NAME || 'rounds';
const REACTIONS_TABLE_NAME = process.env.REACTIONS_TABLE_NAME || 'reactions';

export interface DealerReactionResult {
  personaId: string;
  simulationId: string;
  roundNumber: number;
  status: 'complete' | 'failed';
  reaction?: {
    ratePathView: string;
    balanceSheetView: string;
    riskAssetView: string;
    keyConcerns: string[];
    hawkishDovishScore: number;
    confidence: number;
    reasoningMd: string;
    positionShift?: number;
    influencedBy?: string[];
    keyQuote?: string;
  };
  error?: string;
}

export interface WriteRoundInput {
  action?: 'writeRound' | 'registerTaskToken';
  simulationId: string;
  roundNumber: number;
  roundType: 'initial' | 'peer_response' | 'crisis_reevaluation';
  reactions: DealerReactionResult[];
  crisisEventId?: string;
  // For task token registration
  taskToken?: string;
}

export interface WriteRoundOutput {
  simulationId: string;
  roundNumber: number;
  convergenceScore: number;
  completedDealers: number;
  failedDealers: number;
}

export interface RegisterTaskTokenInput {
  action: 'registerTaskToken';
  simulationId: string;
  taskToken: string;
}

type HandlerInput = WriteRoundInput | RegisterTaskTokenInput;

export async function handler(event: HandlerInput): Promise<WriteRoundOutput | { registered: boolean }> {
  // Handle task token registration
  if (event.action === 'registerTaskToken') {
    const { simulationId, taskToken } = event as RegisterTaskTokenInput;
    await registerTaskToken(simulationId, taskToken);
    return { registered: true };
  }

  // Default: write round
  const input = event as WriteRoundInput;
  return writeRound(input);
}

async function writeRound(input: WriteRoundInput): Promise<WriteRoundOutput> {
  const { simulationId, roundNumber, roundType, reactions, crisisEventId } = input;
  const now = new Date().toISOString();
  const paddedRound = String(roundNumber).padStart(3, '0');

  const completedReactions = reactions.filter((r) => r.status === 'complete');
  const failedReactions = reactions.filter((r) => r.status === 'failed');

  // Write round record
  const roundRecord = {
    simulationId,
    roundNumber: paddedRound,
    roundType,
    status: failedReactions.length === reactions.length ? 'failed' : 'complete',
    crisisEventId: crisisEventId || undefined,
    startedAt: now,
    completedAt: now,
    convergenceScore: null as number | null,
  };

  await docClient.send(
    new PutCommand({
      TableName: ROUNDS_TABLE_NAME,
      Item: roundRecord,
    })
  );

  // Write each reaction to reactions table
  for (const result of reactions) {
    const reactionRecord = {
      pk: `${simulationId}#${paddedRound}`,
      personaId: result.personaId,
      simulationId,
      roundNumber,
      roundType,
      status: result.status,
      ratePathView: result.reaction?.ratePathView || null,
      balanceSheetView: result.reaction?.balanceSheetView || null,
      riskAssetView: result.reaction?.riskAssetView || null,
      keyConcerns: result.reaction?.keyConcerns || [],
      hawkishDovishScore: result.reaction?.hawkishDovishScore ?? null,
      confidence: result.reaction?.confidence ?? null,
      reasoningMd: result.reaction?.reasoningMd || null,
      positionShift: result.reaction?.positionShift ?? null,
      influencedBy: result.reaction?.influencedBy || [],
      keyQuote: result.reaction?.keyQuote || null,
      error: result.error || null,
      createdAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: REACTIONS_TABLE_NAME,
        Item: reactionRecord,
      })
    );
  }

  // Calculate convergence score (compare with prior round if roundNumber > 1)
  let convergenceScore = 1.0;
  if (roundNumber > 1) {
    const previousReactions = await loadPreviousRoundReactions(simulationId, roundNumber - 1);
    const currentScores: ReactionScore[] = reactions.map((r) => ({
      personaId: r.personaId,
      hawkishDovishScore: r.reaction?.hawkishDovishScore ?? 0,
      status: r.status,
    }));
    convergenceScore = calculateConvergence(previousReactions, currentScores);
  }

  // Update round record with convergence score
  await docClient.send(
    new PutCommand({
      TableName: ROUNDS_TABLE_NAME,
      Item: {
        ...roundRecord,
        convergenceScore,
      },
    })
  );

  // Update simulation record with current round progress
  await docClient.send(
    new UpdateCommand({
      TableName: SIMULATIONS_TABLE_NAME,
      Key: { simulationId },
      UpdateExpression: 'SET currentRound = :round',
      ExpressionAttributeValues: {
        ':round': roundNumber,
      },
    })
  );

  return {
    simulationId,
    roundNumber,
    convergenceScore,
    completedDealers: completedReactions.length,
    failedDealers: failedReactions.length,
  };
}

async function loadPreviousRoundReactions(
  simulationId: string,
  roundNumber: number
): Promise<ReactionScore[]> {
  const paddedRound = String(roundNumber).padStart(3, '0');
  const pk = `${simulationId}#${paddedRound}`;

  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: REACTIONS_TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: {
          ':pk': pk,
        },
      })
    );

    return (result.Items || []).map((item) => ({
      personaId: item.personaId as string,
      hawkishDovishScore: (item.hawkishDovishScore as number) ?? 0,
      status: (item.status as 'complete' | 'failed') || 'failed',
    }));
  } catch (err) {
    console.error('Failed to load previous round reactions:', err);
    return [];
  }
}

async function registerTaskToken(simulationId: string, taskToken: string): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: SIMULATIONS_TABLE_NAME,
      Key: { simulationId },
      UpdateExpression: 'SET taskToken = :token',
      ExpressionAttributeValues: {
        ':token': taskToken,
      },
    })
  );
}
