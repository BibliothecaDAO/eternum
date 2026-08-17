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
}
