/**
 * Init Simulation Lambda (Step Functions task)
 * First state in the Step Functions state machine.
 * Sets currentRound=1, validates persona IDs, loads event data.
 */

import { UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../lib/dynamodb';
import { PERSONA_IDS } from '../../data/personas/types';
import { SimulationConfig } from './kickoff';

const SIMULATIONS_TABLE_NAME = process.env.SIMULATIONS_TABLE_NAME || 'simulations';
const EVENTS_TABLE_NAME = process.env.EVENTS_TABLE_NAME || 'events';

export interface InitSimulationInput {
  simulationId: string;
  eventId: string;
  eventText: string;
  eventSummary: string;
  personaIds: string[];
  config: SimulationConfig;
}

export interface InitSimulationOutput {
  simulationId: string;
  personaIds: string[];
  eventContext: {
    eventId: string;
    eventText: string;
    eventSummary: string;
  };
  config: SimulationConfig;
  currentRound: number;
}

export async function handler(event: InitSimulationInput): Promise<InitSimulationOutput> {
  const { simulationId, eventId, eventText, eventSummary, personaIds, config } = event;

  // Validate persona IDs
  const validPersonaIds = personaIds.filter((id) =>
    (PERSONA_IDS as readonly string[]).includes(id)
  );

  if (validPersonaIds.length === 0) {
    throw new Error(
      `No valid persona IDs provided. Valid IDs: ${PERSONA_IDS.join(', ')}`
    );
  }

  // Load event data if eventId is provided and eventText is empty
  let resolvedEventText = eventText;
  let resolvedEventSummary = eventSummary;

  if (eventId && !eventText) {
    try {
      const eventResult = await docClient.send(
        new GetCommand({
          TableName: EVENTS_TABLE_NAME,
          Key: { eventId },
        })
      );
      if (eventResult.Item) {
        resolvedEventText = eventResult.Item.rawText || eventResult.Item.eventText || '';
        resolvedEventSummary = eventResult.Item.summary || resolvedEventSummary;
      }
    } catch (err) {
      console.error('Failed to load event data:', err);
      // Continue with whatever text we have
    }
  }

  // Update simulation record: set currentRound=1
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: SIMULATIONS_TABLE_NAME,
        Key: { simulationId },
        UpdateExpression: 'SET currentRound = :round, personaIds = :personas',
        ExpressionAttributeValues: {
          ':round': 1,
          ':personas': validPersonaIds,
        },
      })
    );
  } catch (err) {
    console.error('Failed to update simulation record:', err);
    throw new Error(`Failed to initialize simulation ${simulationId}`);
  }

  return {
    simulationId,
    personaIds: validPersonaIds,
    eventContext: {
      eventId,
      eventText: resolvedEventText,
      eventSummary: resolvedEventSummary,
    },
    config,
    currentRound: 1,
  };
}
