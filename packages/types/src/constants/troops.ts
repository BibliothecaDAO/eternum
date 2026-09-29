import { TroopType } from "../types/common";
const DEFAULT_TROOP_ATTACK_RANGE = 1;
const RANGED_TROOP_ATTACK_RANGE = 2;
export const CROSSBOWMAN_RANGED_FIELD_DAMAGE_MULTIPLIER = 0.7;
export const CROSSBOWMAN_RANGED_STRUCTURE_DAMAGE_MULTIPLIER = 0.3;
export const KNIGHT_STRUCTURE_ASSAULT_DAMAGE_MULTIPLIER = 1.15;
export const KNIGHT_STRUCTURE_GUARD_INCOMING_DAMAGE_MULTIPLIER = 0.85;

type TroopCategory = TroopType | number | string | null | undefined;

export const getTroopAttackRange = (troopType: TroopCategory): number => {
  if (troopType === TroopType.Crossbowman || troopType === 2 || troopType === "2") {
    return RANGED_TROOP_ATTACK_RANGE;
  }

  return DEFAULT_TROOP_ATTACK_RANGE;
};

// Shared NPC ownership label for structures with owner address 0x0.
export const BANDITS_NAME = "The Vanguard";

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
