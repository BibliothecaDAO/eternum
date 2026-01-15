import { TroopTier, TroopType } from "@bibliothecadao/types";

export interface TroopTierAvailability {
  tier: TroopTier;
  available: number;
  resourceTrait: string;
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

export interface GuardSummary {
  slot: bigint | number;
  troops?: {
    category?: TroopType;
    tier?: TroopTier;
    count?: number;
  } | null;
}
