import {
  type HyperstructureResourceCostMinMax,
  type ResourceCost,
  type ResourceCostMinMax,
  ResourceTier,
  ResourcesIds,
} from "@bibliothecadao/types";

export const HYPERSTRUCTURE_CREATION_COSTS: ResourceCostMinMax[] = [
  // this is actually fragments min max since lords and fragments are the same tier and we don't take into account lords
  {
    resource_tier: ResourceTier.Lords,
    min_amount: 3_000_000,
    max_amount: 3_000_000,
  },
];
// tiers aren't the same as in the balancing sheet so this is an adapted version
export const HYPERSTRUCTURE_CONSTRUCTION_COSTS: ResourceCostMinMax[] = [
  // todo: add labor, need to add labor as resource tier in contracts first
  // { resource_tier: ResourceTier.Labor, min_amount: 50_000_000, max_amount: 50_000_000 },
  { resource_tier: ResourceTier.Military, min_amount: 0, max_amount: 0 },
  { resource_tier: ResourceTier.Transport, min_amount: 0, max_amount: 0 },
  { resource_tier: ResourceTier.Food, min_amount: 0, max_amount: 0 },
  {
    resource_tier: ResourceTier.Common,
    min_amount: 175_000_000,
    max_amount: 400_000_000,
  },
  {
    resource_tier: ResourceTier.Uncommon,
    min_amount: 75_000_000,
    max_amount: 125_000_000,
  },
  {
    resource_tier: ResourceTier.Rare,
    min_amount: 45_000_000,
    max_amount: 60_000_000,
  },
  {
    resource_tier: ResourceTier.Unique,
    min_amount: 30_000_000,
    max_amount: 45_000_000,
  },
  {
    resource_tier: ResourceTier.Mythic,
    min_amount: 25_000_000,
    max_amount: 30_000_000,
  },
];

export const HYPERSTRUCTURE_TOTAL_COSTS: ResourceCostMinMax[] = [
  ...HYPERSTRUCTURE_CONSTRUCTION_COSTS,
  ...HYPERSTRUCTURE_CREATION_COSTS,
];

// NEW HYPERSTRUCTURE DATA, DELETE EVERYTHING ON TOP THIS LINE

// ----- Hyperstructures ----- //
export const HYPERSTRUCTURE_POINT_MULTIPLIER = 1_000_000;

export const HYPERSTRUCTURE_POINTS_PER_CYCLE = 7 * HYPERSTRUCTURE_POINT_MULTIPLIER;
export const HYPERSTRUCTURE_POINTS_FOR_WIN = 9_620_000n * BigInt(HYPERSTRUCTURE_POINT_MULTIPLIER);
export const HYPERSTRUCTURE_SHARDS_COST: ResourceCost = {
  resource: ResourcesIds.AncientFragment,
  amount: 50 * HYPERSTRUCTURE_POINT_MULTIPLIER,
};
export const HYPERSTRUCTURE_COSTS: HyperstructureResourceCostMinMax[] = [
  {
    resource_type: ResourcesIds.Wood,
    resource_completion_points: 21_732 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    min_amount: 250 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    max_amount: 400 * HYPERSTRUCTURE_POINT_MULTIPLIER,
  },
  {
    resource_type: ResourcesIds.Stone,
    resource_completion_points: 21_732 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    min_amount: 250 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    max_amount: 400 * HYPERSTRUCTURE_POINT_MULTIPLIER,
  },
  {
    resource_type: ResourcesIds.Coal,
    resource_completion_points: 21_732 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    min_amount: 250 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    max_amount: 400 * HYPERSTRUCTURE_POINT_MULTIPLIER,
  },
  {
    resource_type: ResourcesIds.Copper,
    resource_completion_points: 21_732 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    min_amount: 175 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    max_amount: 250 * HYPERSTRUCTURE_POINT_MULTIPLIER,
  },
  {
    resource_type: ResourcesIds.Obsidian,
    resource_completion_points: 21_732 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    min_amount: 175 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    max_amount: 250 * HYPERSTRUCTURE_POINT_MULTIPLIER,
  },
  {
    resource_type: ResourcesIds.Silver,
    resource_completion_points: 21_732 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    min_amount: 175 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    max_amount: 250 * HYPERSTRUCTURE_POINT_MULTIPLIER,
  },
  {
    resource_type: ResourcesIds.Ironwood,
    resource_completion_points: 21_732 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    min_amount: 75 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    max_amount: 125 * HYPERSTRUCTURE_POINT_MULTIPLIER,
  },
  {
    resource_type: ResourcesIds.ColdIron,
    resource_completion_points: 21_732 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    min_amount: 75 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    max_amount: 125 * HYPERSTRUCTURE_POINT_MULTIPLIER,
  },
  {
    resource_type: ResourcesIds.Gold,
    resource_completion_points: 21_732 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    min_amount: 75 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    max_amount: 125 * HYPERSTRUCTURE_POINT_MULTIPLIER,
  },
  {
    resource_type: ResourcesIds.Hartwood,
    resource_completion_points: 21_732 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    min_amount: 45 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    max_amount: 60 * HYPERSTRUCTURE_POINT_MULTIPLIER,
  },
  {
    resource_type: ResourcesIds.Diamonds,
    resource_completion_points: 21_732 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    min_amount: 45 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    max_amount: 60 * HYPERSTRUCTURE_POINT_MULTIPLIER,
  },
  {
    resource_type: ResourcesIds.Sapphire,
    resource_completion_points: 21_732 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    min_amount: 45 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    max_amount: 60 * HYPERSTRUCTURE_POINT_MULTIPLIER,
  },
  {
    resource_type: ResourcesIds.Ruby,
    resource_completion_points: 21_732 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    min_amount: 45 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    max_amount: 60 * HYPERSTRUCTURE_POINT_MULTIPLIER,
  },
  {
    resource_type: ResourcesIds.DeepCrystal,
    resource_completion_points: 21_732 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    min_amount: 35 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    max_amount: 45 * HYPERSTRUCTURE_POINT_MULTIPLIER,
  },
  {
    resource_type: ResourcesIds.Ignium,
    resource_completion_points: 21_732 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    min_amount: 35 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    max_amount: 45 * HYPERSTRUCTURE_POINT_MULTIPLIER,
  },
  {
    resource_type: ResourcesIds.EtherealSilica,
    resource_completion_points: 21_732 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    min_amount: 35 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    max_amount: 45 * HYPERSTRUCTURE_POINT_MULTIPLIER,
  },
  {
    resource_type: ResourcesIds.TrueIce,
    resource_completion_points: 21_732 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    min_amount: 30 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    max_amount: 35 * HYPERSTRUCTURE_POINT_MULTIPLIER,
  },
  {
    resource_type: ResourcesIds.TwilightQuartz,
    resource_completion_points: 21_732 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    min_amount: 30 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    max_amount: 35 * HYPERSTRUCTURE_POINT_MULTIPLIER,
  },
  {
    resource_type: ResourcesIds.AlchemicalSilver,
    resource_completion_points: 21_732 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    min_amount: 30 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    max_amount: 35 * HYPERSTRUCTURE_POINT_MULTIPLIER,
  },
  {
    resource_type: ResourcesIds.Adamantine,
    resource_completion_points: 21_732 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    min_amount: 25 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    max_amount: 30 * HYPERSTRUCTURE_POINT_MULTIPLIER,
  },
  {
    resource_type: ResourcesIds.Mithral,
    resource_completion_points: 21_732 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    min_amount: 25 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    max_amount: 30 * HYPERSTRUCTURE_POINT_MULTIPLIER,
  },
  {
    resource_type: ResourcesIds.Dragonhide,
    resource_completion_points: 21_732 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    min_amount: 25 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    max_amount: 30 * HYPERSTRUCTURE_POINT_MULTIPLIER,
  },
  {
    resource_type: ResourcesIds.Labor,
    resource_completion_points: 21_732 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    min_amount: 50 * HYPERSTRUCTURE_POINT_MULTIPLIER,
    max_amount: 50 * HYPERSTRUCTURE_POINT_MULTIPLIER,
  },
];
