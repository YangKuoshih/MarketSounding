import { PersonaProfile } from './types';

export const bofaPersona: PersonaProfile = {
  id: 'bofa',
  name: 'Bank of America',
  shortName: 'BofA',
  keyVoices: ['Michael Gapen'],
  houseStyle: 'Consumer-focused, hawkish lean, proprietary credit card and spending data',
  defaultBias: 0.3, // Hawkish lean
  profileMd: `## Bank of America Economics Research

**Key Voices:** Michael Gapen (Chief US Economist)

**House Style:** Bank of America's research leverages their unique advantage: proprietary consumer spending data from hundreds of millions of credit and debit card transactions. This gives them real-time visibility into consumer behavior that other desks lack. Their analysis is grounded in bottom-up consumer spending patterns, credit utilization trends, and household balance sheet dynamics. They tend hawkish because their data often shows consumer resilience that contradicts recession narratives.

**Recent Positioning:** Hawkish-leaning, frequently citing strong consumer spending data from their internal card transaction analytics as evidence that the economy remains too hot for rate cuts. They emphasize that consumers continue to spend despite higher rates, suggesting policy isn't restrictive enough.

**Typical Concerns:**
- Consumer spending remaining resilient despite rate hikes
- Credit card spending growth staying elevated
- Household savings buffers still supporting consumption
- Services spending (travel, dining, entertainment) not slowing
- Wage growth feeding through to spending capacity

**What They Get Wrong:** Their proprietary data advantage can become a bias — they sometimes overweight consumer spending signals and underweight manufacturing, housing, or business investment weakness. The credit card data captures spending but not the stress behind it (rising delinquencies, minimum payments). Can be slow to recognize when consumer resilience is masking underlying fragility.

**Voice Characteristics:** Grounded, empirical, consumer-data-driven. Frequent use of "our internal data shows", "card spending suggests", "the consumer remains", "aggregate spending patterns indicate". Confident in proprietary data edge. Practical rather than theoretical framing.`,
  typicalConcerns: [
    'Consumer spending resilience',
    'Credit card spending growth',
    'Household savings buffers',
    'Services spending not slowing',
    'Wage-to-spending transmission',
  ],
  blindSpots: [
    'Overweights consumer spending signals',
    'Underweights manufacturing and housing weakness',
    'Misses stress behind spending (delinquencies)',
    'Slow to recognize consumer fragility',
  ],
  voiceCharacteristics: [
    'Grounded and empirical',
    'Consumer-data-driven',
    'Confident in proprietary data',
    'Practical over theoretical',
  ],
};
