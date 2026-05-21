/**
 * Dealer Agent Lambda handler.
 * Invoked by Step Functions with dealer agent input payload.
 * Loads persona, builds prompt, invokes Bedrock, parses reaction, updates session state.
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { loadPersona } from '../../data/personas';
import { parseReactionResponse, buildRetryPrompt } from '../../lib/reaction-parser';
import {
  loadSessionState,
  saveSessionState,
  updateSessionState,
  getPriorHdScore,
} from '../../lib/session-state';
import { buildDealerPrompt, PromptPayload } from './prompt-builder';
import { DealerAgentInput, DealerAgentOutput } from './types';

const bedrockClient = new BedrockRuntimeClient({});
const SONNET_MODEL_ID = 'us.anthropic.claude-sonnet-4-6';

/**
 * Lambda handler for dealer agent invocations.
 * Called by Step Functions Map state for each dealer in parallel.
 */
export async function handler(event: DealerAgentInput): Promise<DealerAgentOutput> {
  const { personaId, simulationId, roundNumber, roundType } = event;

  try {
    // 1. Load persona profile
    const persona = loadPersona(personaId);

    // 2. Load session state from DynamoDB
    const sessionState = await loadSessionState(simulationId, personaId);

    // 3. Build prompt based on round type
    const promptPayload = buildDealerPrompt(persona, event, sessionState);

    // 4. Invoke Bedrock
    let rawResponse = await invokeBedrock(promptPayload);

    // 5. Parse and validate reaction
    const priorHdScore = getPriorHdScore(sessionState);
    let parseResult = parseReactionResponse(rawResponse, priorHdScore);

    // 6. Retry once if malformed
    if (!parseResult.success) {
      const retryPrompt = buildRetryPrompt(
        parseResult.error,
        promptPayload.messages[0].content
      );
      const retryPayload: PromptPayload = {
        system: promptPayload.system,
        messages: [{ role: 'user', content: retryPrompt }],
      };
      rawResponse = await invokeBedrock(retryPayload);
      parseResult = parseReactionResponse(rawResponse, priorHdScore);
    }

    if (!parseResult.success) {
      return {
        personaId,
        simulationId,
        roundNumber,
        reaction: createFailedReaction(parseResult.error),
        status: 'failed',
        error: parseResult.error,
      };
    }

    // 7. Update session state
    const updatedState = updateSessionState(sessionState, roundNumber, roundType, parseResult.reaction);
    await saveSessionState(updatedState);

    // 8. Return structured output
    return {
      personaId,
      simulationId,
      roundNumber,
      reaction: parseResult.reaction,
      status: 'complete',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      personaId,
      simulationId,
      roundNumber,
      reaction: createFailedReaction(errorMessage),
      status: 'failed',
      error: errorMessage,
    };
  }
}

/**
 * Invoke Bedrock Claude Sonnet 4.6 with the constructed prompt.
 */
async function invokeBedrock(promptPayload: PromptPayload): Promise<string> {
  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 1500,
    system: promptPayload.system,
    messages: promptPayload.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
  });

  const command = new InvokeModelCommand({
    modelId: SONNET_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: Buffer.from(body),
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const text = responseBody.content?.[0]?.text ?? '';

  if (!text) {
    throw new Error('Empty response from Bedrock');
  }

  return text;
}

function createFailedReaction(error: string) {
  return {
    ratePathView: '',
    balanceSheetView: '',
    riskAssetView: '',
    keyConcerns: [],
    hawkishDovishScore: 0,
    confidence: 0,
    reasoningMd: `Failed to generate reaction: ${error}`,
  };
}
