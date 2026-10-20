import { ResourcesIds, TroopTier, TroopType } from "@bibliothecadao/types";

export interface TroopTierAvailability {
  tier: TroopTier;
  available: number;
  resourceId: ResourcesIds;
}

export interface TroopSelectionOption {
  type: TroopType;
  label: string;
  tiers: TroopTierAvailability[];
}

export interface SelectedTroopCombo {
  type: TroopType;
  tier: TroopTier;
}

/** A troop stack: one type and tier (an army is of one) and how many whole troops, as Next up names it. */
export interface TroopStack extends SelectedTroopCombo {
  count: number;
}

export interface GuardSummary {
  slot: bigint | number;
  /** Seconds before a wiped slot accepts troops again; 0 when open. */
  cooldownRemaining: number;
  troops?: {
    category?: TroopType;
    tier?: TroopTier;
    count?: number;
    staminaCurrent?: number;
    staminaMax?: number;
  } | null;
}
