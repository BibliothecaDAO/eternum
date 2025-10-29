export const MIN_TROOPS_BATTLE = 100_000;

export const MERCENARIES = "Bandits";

export const DAYDREAMS_AGENTS = "Daydreams Agent";

// export const DEFENSE_NAMES = {
//   0: "Watchtower",
//   1: "Outer Wall",
//   2: "Castle Wall",
//   3: "Inner Wall",
// };

/**
 * Guard slot IDs - consistent with Cairo contract GuardSlot enum
 * Guards are attacked in order: Delta (1) -> Charlie (2) -> Bravo (3) -> Alpha (4)
 */
export enum GuardSlot {
  Delta = 4,
  Charlie = 3,
  Bravo = 2,
  Alpha = 1,
}

/**
 * Guard slot names mapped to their IDs
 */
export const GUARD_SLOT_NAMES: Record<GuardSlot, string> = {
  [GuardSlot.Delta]: "Watchtower",
  [GuardSlot.Charlie]: "Outer Wall",
  [GuardSlot.Bravo]: "Castle Wall",
  [GuardSlot.Alpha]: "Inner Wall",
};
