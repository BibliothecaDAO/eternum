import type { Army } from "@bibliothecadao/eternum";
import type { BiomeType, ID } from "@bibliothecadao/types";

export type BattleLabMode = "live" | "sim";

export type WorkingArmy = Army;

/** One selectable guard slot when the attacker is a structure. */
export interface GuardOption {
  slot: number;
  label: string;
  army: WorkingArmy;
}

/** Normalized chain snapshot consumed by the reducer in live mode. */
export interface LiveSnapshot {
  defenderAlt: boolean;
  biome: BiomeType;
  attackerType: "structure" | "army";
  attackerEntityId: ID;
  /** Guard options when the attacker is a structure (empty otherwise). */
  guards: GuardOption[];
  guardSlot: number | null;
  /** Army attacker (null when the attacker is a structure). */
  armyAttacker: WorkingArmy | null;
  /** First defender troop, or null when the target has no defenders (claim). */
  defender: WorkingArmy | null;
}
