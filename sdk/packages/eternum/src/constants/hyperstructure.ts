import { ResourceCostMinMax } from "../types";
import { ResourceTier } from "./index";

export const HYPERSTRUCTURE_CREATION_COSTS: ResourceCostMinMax[] = [
  // this is actually fragments min max since lords and fragments are the same tier and we don't take into account lords
  { resource_tier: ResourceTier.Lords, min_amount: 3000, max_amount: 3000 },
];
export const HYPERSTRUCTURE_CONSTRUCTION_COSTS: ResourceCostMinMax[] = [
  { resource_tier: ResourceTier.Military, min_amount: 0, max_amount: 0 },
  { resource_tier: ResourceTier.Transport, min_amount: 0, max_amount: 0 },
  { resource_tier: ResourceTier.Food, min_amount: 0, max_amount: 0 },
  { resource_tier: ResourceTier.Common, min_amount: 120000, max_amount: 240000 },
  { resource_tier: ResourceTier.Uncommon, min_amount: 90000, max_amount: 180000 },
  { resource_tier: ResourceTier.Rare, min_amount: 40000, max_amount: 80000 },
  { resource_tier: ResourceTier.Unique, min_amount: 20000, max_amount: 40000 },
  { resource_tier: ResourceTier.Mythic, min_amount: 7000, max_amount: 14000 },
];

export const HYPERSTRUCTURE_TOTAL_COSTS: ResourceCostMinMax[] = [
  ...HYPERSTRUCTURE_CONSTRUCTION_COSTS,
  ...HYPERSTRUCTURE_CREATION_COSTS,
];
