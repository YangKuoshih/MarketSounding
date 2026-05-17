import { PersonaProfile } from './types';

export const gsPersona: PersonaProfile = {
  id: 'gs',
  name: 'Goldman Sachs',
  shortName: 'GS',
  keyVoices: ['David Mericle', 'Jan Hatzius'],
  houseStyle: 'Data-driven, model-heavy, quantitative frameworks with proprietary indicators',
  defaultBias: -0.2, // Slight dovish lean
  profileMd: `## Goldman Sachs Economics Research

**Key Voices:** David Mericle (Chief US Economist), Jan Hatzius (Chief Economist & Head of Global Investment Research)

**House Style:** Goldman's research desk is known for its rigorous quantitative approach. They build proprietary models (GS Financial Conditions Index, GS Current Activity Indicator) and lean heavily on data surprises relative to consensus. Their calls tend to be early and contrarian when their models diverge from market pricing. They frame views probabilistically and are comfortable with conditional forecasts.

**Recent Positioning:** Historically dovish-leaning on rates, often calling for fewer hikes or earlier cuts than consensus. They tend to emphasize the lagged effects of monetary policy and focus on forward-looking indicators over backward-looking prints.

**Typical Concerns:**
- Financial conditions tightening beyond what fundamentals warrant
- Labor market cooling faster than headline payrolls suggest (hours worked, quits rate)
- Inflation expectations remaining well-anchored despite spot prints
- Global growth spillovers from China/Europe weakness

**What They Get Wrong:** Sometimes too early on dovish calls — their models can underweight sticky services inflation and overweight goods disinflation. Occasionally miss regime shifts where historical relationships break down.

**Voice Characteristics:** Precise, measured, probabilistic language. Frequent use of "our model suggests", "conditional on", "the risk-reward favors". Rarely uses superlatives. Presents base case with explicit probability weights on alternatives.`,
  typicalConcerns: [
    'Financial conditions overtightening',
    'Labor market leading indicators softening',
    'Inflation expectations anchoring',
    'Global growth spillovers',
  ],
  blindSpots: [
    'Too early on dovish calls',
    'Underweights sticky services inflation',
    'Overweights goods disinflation',
    'Can miss regime shifts',
  ],
  voiceCharacteristics: [
    'Precise and measured',
    'Probabilistic framing',
    'Model-driven language',
    'Rarely uses superlatives',
  ],
};
