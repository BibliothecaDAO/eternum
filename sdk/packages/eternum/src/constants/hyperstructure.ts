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
  { resource_tier: ResourceTier.Common, min_amount: 2, max_amount: 5 },
  { resource_tier: ResourceTier.Uncommon, min_amount: 5, max_amount: 7 },
  { resource_tier: ResourceTier.Rare, min_amount: 1, max_amount: 2 },
  { resource_tier: ResourceTier.Unique, min_amount: 3, max_amount: 5 },
  { resource_tier: ResourceTier.Mythic, min_amount: 15, max_amount: 18 },
];

export const HYPERSTRUCTURE_TOTAL_COSTS: ResourceCostMinMax[] = [
  ...HYPERSTRUCTURE_CONSTRUCTION_COSTS,
  ...HYPERSTRUCTURE_CREATION_COSTS,
];
