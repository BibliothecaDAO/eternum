import { ResourceCostMinMax } from "../types";
import { ResourceTier } from "./index";

export const HYPERSTRUCTURE_CREATION_COSTS: ResourceCostMinMax[] = [
  { resource_tier: ResourceTier.Lords, min_amount: 2000, max_amount: 2000 },
];
export const HYPERSTRUCTURE_CONSTRUCTION_COSTS: ResourceCostMinMax[] = [
  { resource_tier: ResourceTier.Military, min_amount: 0, max_amount: 0 },
  { resource_tier: ResourceTier.Transport, min_amount: 0, max_amount: 0 },
  { resource_tier: ResourceTier.Food, min_amount: 50_000, max_amount: 90_000 },
  { resource_tier: ResourceTier.Common, min_amount: 2_000, max_amount: 5_000 },
  { resource_tier: ResourceTier.Uncommon, min_amount: 5_000, max_amount: 7_000 },
  { resource_tier: ResourceTier.Rare, min_amount: 1_000, max_amount: 2_000 },
  { resource_tier: ResourceTier.Unique, min_amount: 3_000, max_amount: 5_000 },
  { resource_tier: ResourceTier.Mythic, min_amount: 15_000, max_amount: 18_000 },
];

export const HYPERSTRUCTURE_TOTAL_COSTS: ResourceCostMinMax[] = [
  ...HYPERSTRUCTURE_CONSTRUCTION_COSTS,
  ...HYPERSTRUCTURE_CREATION_COSTS,
];
