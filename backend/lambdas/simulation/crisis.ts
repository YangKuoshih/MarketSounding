/**
 * Crisis Injection Lambda
 * Handler for POST /simulations/{id}/crisis
 * Reads simulation record, validates it's still running,
 * calls Step Functions SendTaskSuccess with crisis event data.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SFNClient, SendTaskSuccessCommand } from '@aws-sdk/client-sfn';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../lib/dynamodb';
import { withAuth, UserSession } from '../../lib/auth-middleware';
import { success, badRequest, notFound, conflict, serverError } from '../../lib/response';

const SIMULATIONS_TABLE_NAME = process.env.SIMULATIONS_TABLE_NAME || 'simulations';

const sfnClient = new SFNClient({});

interface CrisisRequest {
  crisisText: string;
}

export const handler = withAuth(async (
  event: APIGatewayProxyEvent,
  session: UserSession
): Promise<APIGatewayProxyResult> => {
  const simulationId = event.pathParameters?.id;

  if (!simulationId) {
    return badRequest('Simulation ID is required');
  }

  // Parse request body
  let body: CrisisRequest;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.crisisText || body.crisisText.trim().length === 0) {
    return badRequest('crisisText is required and must be non-empty');
  }

  // Load simulation record
  let simulation;
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: SIMULATIONS_TABLE_NAME,
        Key: { simulationId },
      })
    );
    simulation = result.Item;
  } catch (err) {
    console.error('Failed to load simulation:', err);
    return serverError('Failed to load simulation');
  }

  if (!simulation) {
    return notFound('Simulation not found');
  }

  // Validate simulation is still running
  if (simulation.status === 'complete') {
    return conflict('Simulation already complete');
  }

  if (simulation.status === 'failed') {
    return conflict('Simulation has failed');
  }

  // Check if task token is registered (crisis injection is enabled and waiting)
  const taskToken = simulation.taskToken;
  if (!taskToken) {
    return badRequest('No crisis injection window available. Crisis injection is not enabled or has already been used for this round.');
  }

  // Build crisis event
  const crisisId = generateId();
  const crisisEvent = {
    crisisId,
    simulationId,
    injectedAfterRound: simulation.currentRound || 1,
    crisisText: body.crisisText.trim(),
    summary: body.crisisText.trim().substring(0, 200),
    injectedAt: new Date().toISOString(),
    injectedBy: session.userId,
  };

  // Send task success to Step Functions with crisis data
  try {
    await sfnClient.send(
      new SendTaskSuccessCommand({
        taskToken,
        output: JSON.stringify({ crisisEvent }),
      })
    );
  } catch (err: unknown) {
    const errorName = (err as { name?: string })?.name;
    if (errorName === 'TaskTimedOut') {
      return conflict('Crisis injection window has expired');
    }
    if (errorName === 'InvalidToken') {
      return badRequest('Crisis injection is no longer available for this round');
    }
    console.error('Failed to send task success:', err);
    return serverError('Failed to inject crisis event');
  }

  // Update simulation record: clear task token and add crisis event
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: SIMULATIONS_TABLE_NAME,
        Key: { simulationId },
        UpdateExpression:
          'SET taskToken = :emptyToken, crisisEvents = list_append(if_not_exists(crisisEvents, :emptyList), :crisis)',
        ExpressionAttributeValues: {
          ':emptyToken': null,
          ':emptyList': [],
          ':crisis': [crisisEvent],
        },
      })
    );
  } catch (err) {
    // Non-critical - the crisis was already injected via SendTaskSuccess
    console.error('Failed to update simulation record with crisis event:', err);
  }

  return success({ acknowledged: true, crisisId });
});

function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
