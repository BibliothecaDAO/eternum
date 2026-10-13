import { Troops } from "@bibliothecadao/types";

export type ArmyStaminaSourceKind = "live";

export interface ArmyStaminaSourceSnapshot {
  source: ArmyStaminaSourceKind;
  amount: bigint;
  settledAt: number;
  troopCount?: number;
  troops?: Troops | null;
}

export interface ArmyStaminaPresentation {
  committedCurrent: number;
  committedMax: number;
  committedRatio: number;
  isRecharging: boolean;
  /** Seconds until the bar is full at the current regeneration; 0 when it already is. */
  secondsUntilFull: number;
}
