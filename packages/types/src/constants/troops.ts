export const MIN_TROOPS_BATTLE = 100_000;

const encodeAsciiFelt = (value: string): string => {
  let hex = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code > 0x7f) {
      throw new Error(`Non-ASCII mercenaries name is not supported: ${value}`);
    }
    hex += code.toString(16).padStart(2, "0");
  }
  return `0x${hex}`;
};

// Shared NPC ownership label for structures with owner address 0x0.
export const BANDITS_NAME = "The Vanguard";
// Short-string felt used by set_mercenaries_name_config onchain.
export const MERCENARIES_NAME_FELT = encodeAsciiFelt(BANDITS_NAME);

export const DAYDREAMS_AGENTS = "Daydreams Agent";

/**
 * Guard slot IDs - consistent with Cairo contract GuardSlot enum
 * Guards are attacked in order: Alpha (0) -> Bravo (1) -> Charlie (2) -> Delta (3)
 */
export enum GuardSlot {
  Alpha,
  Bravo,
  Charlie,
  Delta,
}

export const DISPLAYED_SLOT_NUMBER_MAP: Record<GuardSlot, number> = {
  [GuardSlot.Delta]: 1,
  [GuardSlot.Charlie]: 2,
  [GuardSlot.Bravo]: 3,
  [GuardSlot.Alpha]: 4,
};

/**
 * Guard slot names mapped to their IDs
 */
export const GUARD_SLOT_NAMES: Record<GuardSlot, string> = {
  [GuardSlot.Delta]: "Inner Wall",
  [GuardSlot.Charlie]: "Castle Wall",
  [GuardSlot.Bravo]: "Outer Wall",
  [GuardSlot.Alpha]: "Watchtower",
};
