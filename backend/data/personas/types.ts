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
}

export const PERSONA_IDS = ['gs', 'jpm', 'ms', 'citi', 'bofa'] as const;
export type PersonaId = (typeof PERSONA_IDS)[number];
