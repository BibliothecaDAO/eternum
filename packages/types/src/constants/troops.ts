export const MIN_TROOPS_BATTLE = 100_000;

export const MERCENARIES = "Bandits";

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
