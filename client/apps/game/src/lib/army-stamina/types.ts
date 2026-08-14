import { ID, Troops } from "@bibliothecadao/types";

export type ArmyStaminaSourceKind = "pending" | "live";

export interface ArmyStaminaSourceSnapshot {
  source: ArmyStaminaSourceKind;
  entityId: ID;
  amount: bigint;
  updatedTick: number;
  troopCount?: number;
  capturedAtMs?: number;
  troops?: Troops | null;
}

export type PendingArmyStaminaSourceSnapshot = Omit<ArmyStaminaSourceSnapshot, "source"> & { source: "pending" };

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
