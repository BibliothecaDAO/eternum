import { ID, Troops } from "@bibliothecadao/types";

export type ArmyStaminaSourceKind = "live";

export interface ArmyStaminaSourceSnapshot {
  source: ArmyStaminaSourceKind;
  entityId: ID;
  amount: bigint;
  updatedTick: number;
  troopCount?: number;
  troops?: Troops | null;
}

export interface ArmyStaminaPresentation {
  committedCurrent: number;
  committedMax: number;
  committedRatio: number;
  /** Stamina the next armies tick grants; 0 when the army is full. */
  nextTickGain: number;
  /** Seconds until that gain lands. */
  secondsUntilNextGain: number;
  isRecharging: boolean;
  /** Seconds until the bar is full at the current regeneration; 0 when it already is. */
  secondsUntilFull: number;
}
