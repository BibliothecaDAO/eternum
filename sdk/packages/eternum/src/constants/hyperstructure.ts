import { ResourceCostMinMax } from "../types";
import { ResourceTier } from "./index";

export const HYPERSTRUCTURE_CREATION_COSTS: ResourceCostMinMax[] = [
  // this is actually fragments min max since lords and fragments are the same tier and we don't take into account lords
  { resource_tier: ResourceTier.Lords, min_amount: 1000, max_amount: 1000 },
];
export const HYPERSTRUCTURE_CONSTRUCTION_COSTS: ResourceCostMinMax[] = [
  { resource_tier: ResourceTier.Military, min_amount: 0, max_amount: 0 },
  { resource_tier: ResourceTier.Transport, min_amount: 0, max_amount: 0 },
  { resource_tier: ResourceTier.Food, min_amount: 0, max_amount: 0 },
  { resource_tier: ResourceTier.Common, min_amount: 2000, max_amount: 5000 },
  { resource_tier: ResourceTier.Uncommon, min_amount: 1500, max_amount: 3000 },
  { resource_tier: ResourceTier.Rare, min_amount: 1250, max_amount: 2000 },
  { resource_tier: ResourceTier.Unique, min_amount: 900, max_amount: 1800 },
  { resource_tier: ResourceTier.Mythic, min_amount: 300, max_amount: 800 },
];

export const HYPERSTRUCTURE_TOTAL_COSTS: ResourceCostMinMax[] = [
  ...HYPERSTRUCTURE_CONSTRUCTION_COSTS,
  ...HYPERSTRUCTURE_CREATION_COSTS,
];
