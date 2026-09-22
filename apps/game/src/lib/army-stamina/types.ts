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
  displayCurrent: number;
  displayRatio: number;
  nextTickGain: number;
  progressToNextTick: number;
  isRecharging: boolean;
  /** Seconds until the bar is full at the current regeneration; 0 when it already is. */
  secondsUntilFull: number;
}
