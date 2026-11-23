// The name of the zero address, the owner of every structure and army no player holds (camps, rifts, hyperstructures,
// sites): every surface that names an owner reads it through displayPlayerName.
export const NEUTRAL_OWNER_NAME = "The Vanguard";

// Native guard IDs; each structure unlocks a contiguous prefix.
export enum GuardSlot {
  Delta = 0,
  Gamma = 1,
  Beta = 2,
  Alpha = 3,
}

export const GUARD_SLOT_ORDER: GuardSlot[] = [GuardSlot.Delta, GuardSlot.Gamma, GuardSlot.Beta, GuardSlot.Alpha];

export const DISPLAYED_SLOT_NUMBER_MAP: Record<GuardSlot, number> = {
  [GuardSlot.Delta]: 1,
  [GuardSlot.Gamma]: 2,
  [GuardSlot.Beta]: 3,
  [GuardSlot.Alpha]: 4,
};

export const GUARD_SLOT_NAMES: Record<GuardSlot, string> = {
  [GuardSlot.Delta]: "Inner Wall",
  [GuardSlot.Gamma]: "Castle Wall",
  [GuardSlot.Beta]: "Outer Wall",
  [GuardSlot.Alpha]: "Watchtower",
};
