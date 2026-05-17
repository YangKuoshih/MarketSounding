/**
 * Simulation Kickoff Lambda
 * Handles:
 *   POST /simulations - Create and start a new simulation
 *   GET /simulations - List user's simulations
 *   GET /simulations/{id} - Get a single simulation
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { PutCommand, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../lib/dynamodb';
import { withAuth, UserSession } from '../../lib/auth-middleware';
import {
  accepted,
  success,
  badRequest,
  notFound,
  serverError,
  methodNotAllowed,
} from '../../lib/response';
import { PERSONA_IDS } from '../../data/personas/types';

const SIMULATIONS_TABLE_NAME = process.env.SIMULATIONS_TABLE_NAME || 'simulations';
const EVENTS_TABLE_NAME = process.env.EVENTS_TABLE_NAME || 'events';
const ROUNDS_TABLE_NAME = process.env.ROUNDS_TABLE_NAME || 'rounds';
const REACTIONS_TABLE_NAME = process.env.REACTIONS_TABLE_NAME || 'reactions';
const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN || '';

const sfnClient = new SFNClient({});

export interface SimulationConfig {
  maxRounds: number;
  convergenceThreshold: number;
  enableCrisisInjection: boolean;
  crisisWaitTimeoutSeconds: number;
}

const DEFAULT_CONFIG: SimulationConfig = {
  maxRounds: 3,
  convergenceThreshold: 0.1,
  enableCrisisInjection: true,
  crisisWaitTimeoutSeconds: 120,
};

interface CreateSimulationRequest {
  eventId?: string;
  eventText?: string;
  topic?: string;
  title?: string;
  config?: Partial<SimulationConfig>;
}

export const handler = withAuth(async (
  event: APIGatewayProxyEvent,
  session: UserSession
): Promise<APIGatewayProxyResult> => {
  const method = event.httpMethod;
  const pathParams = event.pathParameters;

  // GET /simulations/{id}
  if (method === 'GET' && pathParams?.id) {
    return getSimulation(pathParams.id, session);
  }

  // GET /simulations
  if (method === 'GET') {
    return listSimulations(session);
  }

  // POST /simulations
  if (method === 'POST') {
    return createSimulation(event, session);
  }

  return methodNotAllowed();
});

async function createSimulation(
  event: APIGatewayProxyEvent,
  session: UserSession
): Promise<APIGatewayProxyResult> {
  let body: CreateSimulationRequest;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return badRequest('Invalid JSON body');
  }

  const { eventId, eventText, topic, title, config: userConfig } = body;

  // Must have either eventId or eventText
  if (!eventId && !eventText) {
    return badRequest('Either eventId or eventText is required');
  }

  // Resolve event data
  let resolvedEventText = eventText || '';
  let resolvedEventSummary = '';
  let resolvedEventId = eventId || '';

  if (eventId) {
    try {
      const eventResult = await docClient.send(
        new GetCommand({
          TableName: EVENTS_TABLE_NAME,
          Key: { eventId },
        })
      );
      if (!eventResult.Item) {
        return badRequest(`Event not found: ${eventId}`);
      }
      resolvedEventText = eventResult.Item.rawText || eventResult.Item.eventText || '';
      resolvedEventSummary = eventResult.Item.summary || '';
    } catch (err) {
      console.error('Failed to load event:', err);
      return serverError('Failed to load event data');
    }
  }

  // Build config with defaults
  const simulationConfig: SimulationConfig = {
    maxRounds: clampNumber(userConfig?.maxRounds, 3, 5, DEFAULT_CONFIG.maxRounds),
    convergenceThreshold: userConfig?.convergenceThreshold ?? DEFAULT_CONFIG.convergenceThreshold,
    enableCrisisInjection: userConfig?.enableCrisisInjection ?? DEFAULT_CONFIG.enableCrisisInjection,
    crisisWaitTimeoutSeconds:
      userConfig?.crisisWaitTimeoutSeconds ?? DEFAULT_CONFIG.crisisWaitTimeoutSeconds,
  };

  const simulationId = generateId();
  const now = new Date().toISOString();
  const personaIds = [...PERSONA_IDS];

  // Create simulation record
  const simulationRecord = {
    simulationId,
    eventId: resolvedEventId,
    userId: session.userId,
    status: 'running',
    personaIds,
    config: simulationConfig,
    currentRound: 0,
    totalRounds: simulationConfig.maxRounds,
    stepFunctionExecutionArn: '',
    crisisEvents: [],
    title: title || topic || 'Untitled Simulation',
    createdAt: now,
    completedAt: null,
    error: null,
  };

  try {
    await docClient.send(
      new PutCommand({
        TableName: SIMULATIONS_TABLE_NAME,
        Item: simulationRecord,
      })
    );
  } catch (err) {
    console.error('Failed to create simulation record:', err);
    return serverError('Failed to create simulation');
  }

  // Start Step Functions execution
  try {
    const executionInput = {
      simulationId,
      eventId: resolvedEventId,
      eventText: resolvedEventText,
      eventSummary: resolvedEventSummary,
      personaIds,
      config: simulationConfig,
    };

    const result = await sfnClient.send(
      new StartExecutionCommand({
        stateMachineArn: STATE_MACHINE_ARN,
        name: `sim-${simulationId}-${Date.now()}`,
        input: JSON.stringify(executionInput),
      })
    );

    // Update simulation record with execution ARN
    if (result.executionArn) {
      await docClient.send(
        new PutCommand({
          TableName: SIMULATIONS_TABLE_NAME,
          Item: {
            ...simulationRecord,
            stepFunctionExecutionArn: result.executionArn,
          },
        })
      );
    }
  } catch (err) {
    console.error('Failed to start Step Functions execution:', err);
    // Update simulation status to failed
    await docClient.send(
      new PutCommand({
        TableName: SIMULATIONS_TABLE_NAME,
        Item: {
          ...simulationRecord,
          status: 'failed',
          error: 'Failed to start simulation execution',
        },
      })
    );
    return serverError('Failed to start simulation');
  }

  return accepted({ simulationId });
}

async function listSimulations(session: UserSession): Promise<APIGatewayProxyResult> {
  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: SIMULATIONS_TABLE_NAME,
        IndexName: 'userId-createdAt-index',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': session.userId,
        },
        ScanIndexForward: false, // Most recent first
      })
    );

    return success({ simulations: result.Items || [] });
  } catch (err) {
    console.error('Failed to list simulations:', err);
    return serverError('Failed to list simulations');
  }
}

async function getSimulation(
  simulationId: string,
  session: UserSession
): Promise<APIGatewayProxyResult> {
  try {
    // Load simulation record
    const simResult = await docClient.send(
      new GetCommand({
        TableName: SIMULATIONS_TABLE_NAME,
        Key: { simulationId },
      })
    );

    if (!simResult.Item) {
      return notFound('Simulation not found');
    }

    const simulation = simResult.Item;

    // Enforce user ownership (return 404 to avoid leaking existence)
    if (simulation.userId !== session.userId) {
      return notFound('Simulation not found');
    }

    // Load all rounds for this simulation
    const roundsResult = await docClient.send(
      new QueryCommand({
        TableName: ROUNDS_TABLE_NAME,
        KeyConditionExpression: 'simulationId = :sid',
        ExpressionAttributeValues: {
          ':sid': simulationId,
        },
        ScanIndexForward: true, // Round 1 first
      })
    );

    // Load all reactions for this simulation
    const reactionsResult = await docClient.send(
      new QueryCommand({
        TableName: REACTIONS_TABLE_NAME,
        IndexName: 'simulationId-index',
        KeyConditionExpression: 'simulationId = :sid',
        ExpressionAttributeValues: {
          ':sid': simulationId,
        },
        ScanIndexForward: true,
      })
    );

    const rounds = roundsResult.Items || [];
    const reactions = reactionsResult.Items || [];

    // Merge: each round gets its associated reactions
    const roundsWithReactions = rounds.map((round) => {
      const roundReactions = reactions.filter(
        (r) => r.roundNumber === Number(round.roundNumber)
      );
      return {
        ...round,
        reactions: roundReactions,
      };
    });

    // Load event metadata if available
    let eventData = null;
    if (simulation.eventId) {
      try {
        const eventResult = await docClient.send(
          new GetCommand({
            TableName: EVENTS_TABLE_NAME,
            Key: { eventId: simulation.eventId },
          })
        );
        if (eventResult.Item) {
          eventData = {
            title: eventResult.Item.title,
            summary: eventResult.Item.summary,
            sources: eventResult.Item.sources || [],
          };
        }
      } catch (err) {
        console.warn('Failed to load event metadata:', err);
      }
    }

    return success({
      simulationId: simulation.simulationId,
      status: simulation.status,
      currentRound: simulation.currentRound,
      totalRounds: simulation.totalRounds,
      personaIds: simulation.personaIds,
      config: simulation.config,
      title: simulation.title,
      createdAt: simulation.createdAt,
      completedAt: simulation.completedAt,
      error: simulation.error,
      crisisEvents: simulation.crisisEvents || [],
      event: eventData,
      rounds: roundsWithReactions,
      transcriptUrl: simulation.transcriptUrl || null,
    });
  } catch (err) {
    console.error('Failed to get simulation:', err);
    return serverError('Failed to get simulation');
  }
}

function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function clampNumber(
  value: number | undefined,
  min: number,
  max: number,
  defaultValue: number
): number {
  if (value === undefined || value === null) return defaultValue;
  return Math.max(min, Math.min(max, value));
}
