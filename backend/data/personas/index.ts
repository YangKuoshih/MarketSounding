import { PersonaProfile, PersonaId, PERSONA_IDS } from './types';
import { gsPersona } from './gs';
import { jpmPersona } from './jpm';
import { msPersona } from './ms';
import { citiPersona } from './citi';
import { bofaPersona } from './bofa';

export { PersonaProfile, PersonaId, PERSONA_IDS } from './types';

const personaMap: Record<PersonaId, PersonaProfile> = {
  gs: gsPersona,
  jpm: jpmPersona,
  ms: msPersona,
  citi: citiPersona,
  bofa: bofaPersona,
};

/**
 * Load a persona profile by ID.
 * Throws if the persona ID is not recognized.
 */
export function loadPersona(personaId: string): PersonaProfile {
  if (!isValidPersonaId(personaId)) {
    throw new Error(`Unknown persona ID: ${personaId}. Valid IDs: ${PERSONA_IDS.join(', ')}`);
  }
  return personaMap[personaId];
}

/**
 * Load all persona profiles.
 */
export function loadAllPersonas(): PersonaProfile[] {
  return PERSONA_IDS.map((id) => personaMap[id]);
}

/**
 * Type guard for valid persona IDs.
 */
export function isValidPersonaId(id: string): id is PersonaId {
  return (PERSONA_IDS as readonly string[]).includes(id);
}
