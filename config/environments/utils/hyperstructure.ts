import { ResourceTier, type ResourceCostMinMax } from "@bibliothecadao/eternum";

export const HYPERSTRUCTURE_CREATION_COSTS: ResourceCostMinMax[] = [
  // this is actually fragments min max since lords and fragments are the same tier and we don't take into account lords
  { resource_tier: ResourceTier.Lords, min_amount: 3_000_000, max_amount: 3_000_000 },
];
// tiers aren't the same as in the balancing sheet so this is an adapted version
export const HYPERSTRUCTURE_CONSTRUCTION_COSTS: ResourceCostMinMax[] = [
  // todo: add labor, need to add labor as resource tier in contracts first
  // { resource_tier: ResourceTier.Labor, min_amount: 50_000_000, max_amount: 50_000_000 },
  { resource_tier: ResourceTier.Military, min_amount: 0, max_amount: 0 },
  { resource_tier: ResourceTier.Transport, min_amount: 0, max_amount: 0 },
  { resource_tier: ResourceTier.Food, min_amount: 0, max_amount: 0 },
  { resource_tier: ResourceTier.Common, min_amount: 175_000_000, max_amount: 400_000_000 },
  { resource_tier: ResourceTier.Uncommon, min_amount: 75_000_000, max_amount: 125_000_000 },
  { resource_tier: ResourceTier.Rare, min_amount: 45_000_000, max_amount: 60_000_000 },
  { resource_tier: ResourceTier.Unique, min_amount: 30_000_000, max_amount: 45_000_000 },
  { resource_tier: ResourceTier.Mythic, min_amount: 25_000_000, max_amount: 30_000_000 },
];

export const HYPERSTRUCTURE_TOTAL_COSTS: ResourceCostMinMax[] = [
  ...HYPERSTRUCTURE_CONSTRUCTION_COSTS,
  ...HYPERSTRUCTURE_CREATION_COSTS,
];
