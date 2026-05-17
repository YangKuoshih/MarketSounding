/**
 * Transcript Generator
 * Produces markdown-formatted round-by-round narrative of the simulation.
 * Identifies anchor (least movement) and swing (most movement) dealers.
 * Includes cluster analysis showing aligned dealers and outliers.
 */

export interface TranscriptReaction {
  personaId: string;
  personaName: string;
  shortName: string;
  roundNumber: number;
  roundType: 'initial' | 'peer_response' | 'crisis_reevaluation';
  status: 'complete' | 'failed';
  ratePathView: string;
  balanceSheetView: string;
  riskAssetView: string;
  keyConcerns: string[];
  hawkishDovishScore: number;
  confidence: number;
  reasoningMd: string;
  positionShift?: number | null;
  influencedBy?: string[];
  keyQuote?: string | null;
}

export interface TranscriptRound {
  roundNumber: number;
  roundType: 'initial' | 'peer_response' | 'crisis_reevaluation';
  reactions: TranscriptReaction[];
}

export interface TranscriptInput {
  simulationId: string;
  eventTitle: string;
  eventSummary: string;
  eventDate: string;
  rounds: TranscriptRound[];
  crisisEvents?: { crisisText: string; injectedAfterRound: number }[];
}

export interface TranscriptOutput {
  markdown: string;
  anchorDealer: { personaId: string; totalShift: number };
  swingDealer: { personaId: string; totalShift: number };
  clusters: { aligned: string[][]; outliers: string[] };
}

export function generateTranscript(input: TranscriptInput): TranscriptOutput {
  const { simulationId, eventTitle, eventSummary, eventDate, rounds, crisisEvents } = input;

  // Calculate total position shifts per dealer
  const dealerShifts = calculateDealerShifts(rounds);
  const anchorDealer = findAnchorDealer(dealerShifts);
  const swingDealer = findSwingDealer(dealerShifts);
  const clusters = computeClusters(rounds);

  // Build markdown
  const sections: string[] = [];

  // Header
  sections.push(`# Market Sounding Transcript: ${eventTitle}`);
  sections.push(`**Date:** ${eventDate} | **Simulation:** ${simulationId}`);
  sections.push(`**Summary:** ${eventSummary}`);
  sections.push('');
  sections.push('---');
  sections.push('');

  // Summary section
  sections.push('## Summary');
  sections.push(`- **Rounds completed:** ${rounds.length}`);
  sections.push(`- **Anchor dealer** (least movement): ${anchorDealer.personaId} (total shift: ${anchorDealer.totalShift.toFixed(3)})`);
  sections.push(`- **Swing dealer** (most movement): ${swingDealer.personaId} (total shift: ${swingDealer.totalShift.toFixed(3)})`);
  if (clusters.aligned.length > 0) {
    sections.push(`- **Aligned clusters:** ${clusters.aligned.map(c => c.join(', ')).join(' | ')}`);
  }
  if (clusters.outliers.length > 0) {
    sections.push(`- **Outliers:** ${clusters.outliers.join(', ')}`);
  }
  sections.push('');

  // Round-by-round narrative
  for (const round of rounds) {
    const roundLabel = getRoundLabel(round.roundType, round.roundNumber);
    sections.push(`## ${roundLabel}`);
    sections.push('');

    // Check if this round follows a crisis injection
    const crisis = crisisEvents?.find(c => c.injectedAfterRound === round.roundNumber - 1);
    if (crisis) {
      sections.push(`> **Crisis injected:** ${crisis.crisisText}`);
      sections.push('');
    }

    for (const reaction of round.reactions) {
      if (reaction.status === 'failed') {
        sections.push(`### ${reaction.personaName} (${reaction.shortName}) — FAILED`);
        sections.push('*Reaction failed for this round.*');
        sections.push('');
        continue;
      }

      const hdLabel = reaction.hawkishDovishScore >= 0
        ? `+${reaction.hawkishDovishScore.toFixed(2)}`
        : reaction.hawkishDovishScore.toFixed(2);

      sections.push(`### ${reaction.personaName} (${reaction.shortName}) — H/D: ${hdLabel}`);

      if (reaction.positionShift != null && round.roundNumber > 1) {
        const shiftDir = reaction.positionShift > 0 ? 'hawkish' : reaction.positionShift < 0 ? 'dovish' : 'unchanged';
        sections.push(`*Position shift: ${reaction.positionShift > 0 ? '+' : ''}${reaction.positionShift.toFixed(2)} (${shiftDir})*`);
        if (reaction.influencedBy && reaction.influencedBy.length > 0) {
          sections.push(`*Influenced by: ${reaction.influencedBy.join(', ')}*`);
        }
        if (reaction.keyQuote) {
          sections.push(`*Key quote: "${reaction.keyQuote}"*`);
        }
      }

      sections.push('');
      sections.push(reaction.reasoningMd);
      sections.push('');
      sections.push(`- **Rate path:** ${reaction.ratePathView}`);
      sections.push(`- **Balance sheet:** ${reaction.balanceSheetView}`);
      sections.push(`- **Risk assets:** ${reaction.riskAssetView}`);
      sections.push(`- **Key concerns:** ${reaction.keyConcerns.join(', ')}`);
      sections.push(`- **Confidence:** ${reaction.confidence.toFixed(2)}`);
      sections.push('');
    }
  }

  return {
    markdown: sections.join('\n'),
    anchorDealer,
    swingDealer,
    clusters,
  };
}

function calculateDealerShifts(rounds: TranscriptRound[]): Map<string, number> {
  const shifts = new Map<string, number>();

  for (const round of rounds) {
    for (const reaction of round.reactions) {
      if (reaction.status === 'failed') continue;
      const current = shifts.get(reaction.personaId) ?? 0;
      shifts.set(reaction.personaId, current + Math.abs(reaction.positionShift ?? 0));
    }
  }

  return shifts;
}

function findAnchorDealer(shifts: Map<string, number>): { personaId: string; totalShift: number } {
  let min = { personaId: 'unknown', totalShift: Infinity };
  for (const [personaId, totalShift] of shifts) {
    if (totalShift < min.totalShift) {
      min = { personaId, totalShift };
    }
  }
  return min;
}

function findSwingDealer(shifts: Map<string, number>): { personaId: string; totalShift: number } {
  let max = { personaId: 'unknown', totalShift: -Infinity };
  for (const [personaId, totalShift] of shifts) {
    if (totalShift > max.totalShift) {
      max = { personaId, totalShift };
    }
  }
  return max;
}

function computeClusters(rounds: TranscriptRound[]): { aligned: string[][]; outliers: string[] } {
  // Use final round scores for clustering
  const finalRound = rounds[rounds.length - 1];
  if (!finalRound) return { aligned: [], outliers: [] };

  const scores = finalRound.reactions
    .filter(r => r.status === 'complete')
    .map(r => ({ personaId: r.personaId, score: r.hawkishDovishScore }));

  // Simple proximity clustering: dealers within 0.2 of each other are "aligned"
  const PROXIMITY_THRESHOLD = 0.2;
  const clusters: string[][] = [];
  const assigned = new Set<string>();

  for (const dealer of scores) {
    if (assigned.has(dealer.personaId)) continue;

    const cluster = [dealer.personaId];
    assigned.add(dealer.personaId);

    for (const other of scores) {
      if (assigned.has(other.personaId)) continue;
      if (Math.abs(dealer.score - other.score) <= PROXIMITY_THRESHOLD) {
        cluster.push(other.personaId);
        assigned.add(other.personaId);
      }
    }

    clusters.push(cluster);
  }

  // Clusters with 1 member are outliers
  const aligned = clusters.filter(c => c.length > 1);
  const outliers = clusters.filter(c => c.length === 1).map(c => c[0]);

  return { aligned, outliers };
}

function getRoundLabel(roundType: string, roundNumber: number): string {
  switch (roundType) {
    case 'initial':
      return `Round ${roundNumber}: Initial Reactions`;
    case 'peer_response':
      return `Round ${roundNumber}: Peer Response`;
    case 'crisis_reevaluation':
      return `Round ${roundNumber}: Crisis Re-evaluation`;
    default:
      return `Round ${roundNumber}`;
  }
}
