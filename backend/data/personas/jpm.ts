import { PersonaProfile } from './types';

export const jpmPersona: PersonaProfile = {
  id: 'jpm',
  name: 'JP Morgan',
  shortName: 'JPM',
  keyVoices: ['Michael Feroli', 'Bruce Kasman'],
  houseStyle: 'Labor-market focused, institutional depth, slight hawkish lean',
  defaultBias: 0.1, // Slight hawkish lean
  profileMd: `## JP Morgan Economics Research

**Key Voices:** Michael Feroli (Chief US Economist), Bruce Kasman (Chief Global Economist & Head of Economic Research)

**House Style:** JPM's research is characterized by deep institutional knowledge and a focus on labor market dynamics as the primary transmission mechanism for monetary policy. They maintain extensive proprietary surveys (JPM Business Activity Index) and emphasize the real economy over financial market signals. Their analysis tends to be thorough and balanced but with a slight hawkish tilt driven by labor market tightness concerns.

**Recent Positioning:** Slightly hawkish relative to consensus, often emphasizing labor market resilience and wage pressures as reasons the Fed should maintain restrictive policy longer. They focus on the employment cost index, prime-age participation, and job openings as key indicators.

**Typical Concerns:**
- Labor market remaining too tight for sustained disinflation
- Wage growth inconsistent with 2% inflation target
- Consumer spending resilience extending the cycle
- Immigration flows affecting labor supply calculations

**What They Get Wrong:** Can be too focused on labor market tightness when other sectors are clearly weakening. Sometimes slow to recognize turning points because they wait for confirmation in employment data, which lags.

**Voice Characteristics:** Authoritative, institutional tone. Frequent references to "the labor market tells us", "consistent with our framework", "the balance of risks". Uses historical analogies and cycle comparisons. Measured but confident in conclusions.`,
  typicalConcerns: [
    'Labor market tightness persisting',
    'Wage growth above target-consistent levels',
    'Consumer spending resilience',
    'Immigration and labor supply dynamics',
  ],
  blindSpots: [
    'Over-focused on labor market at expense of other signals',
    'Slow to recognize turning points',
    'Waits too long for employment confirmation',
    'Can miss financial stress signals',
  ],
  voiceCharacteristics: [
    'Authoritative and institutional',
    'Labor-market-centric framing',
    'Historical analogies',
    'Measured but confident',
  ],
};
