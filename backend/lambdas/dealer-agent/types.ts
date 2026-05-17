/**
 * Type definitions for the Dealer Agent Lambda.
 */

import { Reaction } from '../../lib/reaction-parser';

export interface EventContext {
  eventId: string;
  eventText: string;
  eventSummary: string;
  eventDate?: string;
}

export interface PeerReaction {
  personaId: string;
  personaName: string;
  ratePathView: string;
  balanceSheetView: string;
  riskAssetView: string;
  keyConcerns: string[];
  hawkishDovishScore: number;
  confidence: number;
  reasoningMd: string;
  keyQuote?: string;
}

export interface CrisisEvent {
  crisisId: string;
  crisisText: string;
  summary?: string;
  injectedAfterRound: number;
}

export interface DealerAgentInput {
  personaId: string;
  simulationId: string;
  roundNumber: number;
  roundType: 'initial' | 'peer_response' | 'crisis_reevaluation';
  eventContext: EventContext;
  peerReactions?: PeerReaction[];
  crisisEvent?: CrisisEvent;
}

export interface DealerAgentOutput {
  personaId: string;
  simulationId: string;
  roundNumber: number;
  reaction: Reaction;
  status: 'complete' | 'failed';
  error?: string;
}
