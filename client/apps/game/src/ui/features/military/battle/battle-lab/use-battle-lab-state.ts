import { BiomeType, ResourcesIds, TroopTier, TroopType } from "@bibliothecadao/types";
import { useReducer } from "react";

import type { BattleLabMode, LiveSnapshot, WorkingArmy } from "./battle-lab.types";

export type AttackMode = "attack" | "raid";

interface BattleLabState {
  mode: BattleLabMode;
  attackType: AttackMode;
  biome: BiomeType;
  attacker: WorkingArmy;
  defender: WorkingArmy;
  /** false → live target with no defenders (claim) */
  hasDefender: boolean;
  /** selected guard slot when the attacker is a structure (live mode) */
  selectedGuardSlot: number | null;
  /** baseline captured from chain; null in pure-sim with no chain context */
  live: {
    biome: BiomeType;
    attacker: WorkingArmy;
    defender: WorkingArmy;
    hasDefender: boolean;
  } | null;
}

type BattleLabAction =
  | { type: "INIT_SIM"; biome: BiomeType }
  | { type: "INIT_LIVE"; snapshot: LiveSnapshot }
  | { type: "SET_BIOME"; biome: BiomeType }
  | { type: "PATCH_ATTACKER"; patch: Partial<WorkingArmy> }
  | { type: "PATCH_DEFENDER"; patch: Partial<WorkingArmy> }
  | { type: "SET_ATTACK_TYPE"; attackType: AttackMode }
  | { type: "SELECT_GUARD_SLOT"; slot: number; army: WorkingArmy }
  | { type: "RESET_TO_LIVE" };

const DEFAULT_ATTACKER: WorkingArmy = {
  stamina: 100,
  troopCount: 100,
  troopType: TroopType.Knight,
  tier: TroopTier.T1,
  battle_cooldown_end: 0,
  relics: [],
};

const DEFAULT_DEFENDER: WorkingArmy = {
  stamina: 100,
  troopCount: 100,
  troopType: TroopType.Crossbowman,
  tier: TroopTier.T1,
  battle_cooldown_end: 0,
  relics: [],
};

const sameRelics = (a: ResourcesIds[], b: ResourcesIds[]) => {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((id, i) => id === sb[i]);
};

const sameEditable = (a: WorkingArmy, b: WorkingArmy) =>
  a.stamina === b.stamina &&
  a.troopCount === b.troopCount &&
  a.troopType === b.troopType &&
  a.tier === b.tier &&
  sameRelics(a.relics, b.relics);

/** Derived: has the user edited any working value away from the live baseline? */
const selectIsEdited = (state: BattleLabState): boolean => {
  if (!state.live) return false;
  return (
    state.biome !== state.live.biome ||
    !sameEditable(state.attacker, state.live.attacker) ||
    !sameEditable(state.defender, state.live.defender)
  );
};

/** Pick the attacker working army for the preferred guard slot (or first guard / army). */
const resolveLiveAttacker = (
  snapshot: LiveSnapshot,
  preferredSlot: number | null,
): { army: WorkingArmy; slot: number | null } => {
  if (snapshot.attackerType === "structure") {
    const guard = snapshot.guards.find((g) => g.slot === preferredSlot) ?? snapshot.guards[0] ?? null;
    return { army: guard?.army ?? DEFAULT_ATTACKER, slot: guard?.slot ?? null };
  }
  return { army: snapshot.armyAttacker ?? DEFAULT_ATTACKER, slot: null };
};

const reducer = (state: BattleLabState, action: BattleLabAction): BattleLabState => {
  switch (action.type) {
    case "INIT_SIM":
      return {
        mode: "sim",
        attackType: "attack",
        biome: action.biome,
        attacker: DEFAULT_ATTACKER,
        defender: DEFAULT_DEFENDER,
        hasDefender: true,
        selectedGuardSlot: null,
        live: null,
      };

    case "INIT_LIVE": {
      const { snapshot } = action;
      const { army: attacker, slot } = resolveLiveAttacker(snapshot, state.selectedGuardSlot);
      const defender = snapshot.defender ?? DEFAULT_DEFENDER;
      const hasDefender = snapshot.defender !== null;
      return {
        ...state,
        mode: "live",
        biome: snapshot.biome,
        attacker,
        defender,
        hasDefender,
        selectedGuardSlot: slot,
        live: { biome: snapshot.biome, attacker, defender, hasDefender },
      };
    }

    case "SET_BIOME":
      return { ...state, biome: action.biome };

    case "PATCH_ATTACKER":
      return { ...state, attacker: { ...state.attacker, ...action.patch } };

    case "PATCH_DEFENDER":
      return { ...state, defender: { ...state.defender, ...action.patch } };

    case "SET_ATTACK_TYPE":
      return { ...state, attackType: action.attackType };

    case "SELECT_GUARD_SLOT": {
      // Selecting a guard re-baselines the attacker, so it never reads as an edit.
      const live = state.live ? { ...state.live, attacker: action.army } : null;
      return { ...state, attacker: action.army, selectedGuardSlot: action.slot, live };
    }

    case "RESET_TO_LIVE": {
      if (!state.live) return state;
      return {
        ...state,
        biome: state.live.biome,
        attacker: state.live.attacker,
        defender: state.live.defender,
        hasDefender: state.live.hasDefender,
      };
    }

    default:
      return state;
  }
};

const initialState = (mode: BattleLabMode, biome: BiomeType): BattleLabState => ({
  mode,
  attackType: "attack",
  biome,
  attacker: DEFAULT_ATTACKER,
  defender: DEFAULT_DEFENDER,
  hasDefender: true,
  selectedGuardSlot: null,
  live: null,
});

export const useBattleLabState = (mode: BattleLabMode, initialBiome: BiomeType = BiomeType.Grassland) => {
  const [state, dispatch] = useReducer(reducer, initialState(mode, initialBiome));
  return { state, dispatch, isEdited: selectIsEdited(state) };
};
