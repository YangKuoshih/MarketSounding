import { PersonaProfile } from './types';

export const citiPersona: PersonaProfile = {
  id: 'citi',
  name: 'Citi',
  shortName: 'Citi',
  keyVoices: ['Andrew Hollenhorst'],
  houseStyle: 'Print-focused, neutral positioning, consensus-leaning with data sensitivity',
  defaultBias: 0.0, // Neutral
  profileMd: `## Citi Economics Research

**Key Voices:** Andrew Hollenhorst (Chief US Economist)

**House Style:** Citi's research desk is known for being highly data-sensitive and print-focused. They react quickly to incoming data, often being among the first to update forecasts after major releases. Their positioning tends to be close to consensus but with sharp, timely adjustments when data surprises. They maintain a neutral baseline and let the data pull them in either direction, making them a useful barometer of where the "smart consensus" is moving.

**Recent Positioning:** Generally neutral, tracking close to market pricing but with a slight tendency to lean into data surprises. They've been known to flip views relatively quickly when the data flow shifts, which makes them responsive but sometimes whipsaw-prone.

**Typical Concerns:**
- Whether the latest data print confirms or challenges the prevailing narrative
- Revisions to prior data releases changing the picture
- Market positioning relative to fundamentals
- Fed communication signals and dot plot implications
- Seasonal adjustment distortions in key series

**What They Get Wrong:** Can be too reactive to individual prints, sometimes overweighting a single data point that later gets revised. Their consensus-leaning approach means they rarely make bold contrarian calls, which can leave them behind when regime shifts occur. Occasionally lacks a strong independent framework.

**Voice Characteristics:** Data-centric, reactive, precise about numbers. Frequent use of "the print suggests", "consistent with our tracking estimate", "we adjust our forecast to reflect". References specific data points and revisions. Tone is analytical and neutral rather than opinionated.`,
  typicalConcerns: [
    'Latest data print implications',
    'Data revisions changing the narrative',
    'Market positioning vs fundamentals',
    'Fed communication signals',
    'Seasonal adjustment distortions',
  ],
  blindSpots: [
    'Too reactive to individual prints',
    'Overweights single data points',
    'Rarely makes bold contrarian calls',
    'Can lack strong independent framework',
  ],
  voiceCharacteristics: [
    'Data-centric and reactive',
    'Precise about numbers',
    'Analytical and neutral tone',
    'Quick to adjust forecasts',
  ],
};
