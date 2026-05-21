/**
 * Persona profile type definition for dealer agents.
 */
export interface PersonaProfile {
  id: string;
  name: string;
  shortName: string;
  keyVoices: string[];
  houseStyle: string;
  defaultBias: number; // H/D lean: negative = dovish, positive = hawkish
  profileMd: string; // Detailed markdown profile (>=100 chars)
  typicalConcerns: string[];
  blindSpots: string[];
  voiceCharacteristics: string[];
  signaturePhrases: string[]; // Phrases/data tools this desk MUST reference to sound authentic
  mustAvoid: string[];        // Phrases/framings that would break character
}

export const PERSONA_IDS = ['gs', 'jpm', 'ms', 'citi', 'bofa'] as const;
export type PersonaId = (typeof PERSONA_IDS)[number];
