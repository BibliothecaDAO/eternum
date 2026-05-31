import type { Army } from "@bibliothecadao/eternum";
import type { BiomeType, ID, ResourcesIds } from "@bibliothecadao/types";

export type BattleLabMode = "live" | "sim";

/** An army the simulator runs on. Mirrors core `Army` + the equipped relics. */
export interface WorkingArmy extends Army {
  relics: ResourcesIds[];
}

/** One selectable guard slot when the attacker is a structure. */
export interface GuardOption {
  slot: number;
  label: string;
  army: WorkingArmy;
}

/** Normalized chain snapshot consumed by the reducer in live mode. */
export interface LiveSnapshot {
  biome: BiomeType;
  attackerType: "structure" | "army";
  attackerEntityId: ID;
  /** Guard options when the attacker is a structure (empty otherwise). */
  guards: GuardOption[];
  /** Army attacker (null when the attacker is a structure). */
  armyAttacker: WorkingArmy | null;
  /** First defender troop, or null when the target has no defenders (claim). */
  defender: WorkingArmy | null;
  totalDefenders: number;
  hasTarget: boolean;
}
