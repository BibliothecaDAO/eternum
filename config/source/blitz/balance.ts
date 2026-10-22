import { BuildingType, RealmLevels, ResourcesIds } from "../../../packages/types/src/constants";
import { COMPLEX_BUILDING_COSTS, SIMPLE_BUILDING_COSTS } from "../common/arena/building";
import { VICTORY_POINTS_MULTIPLIER } from "../common/arena/points";
import type { ConfigPatch } from "../common/merge-config";
import {
  buildArenaStartingResources,
  buildComplexBuildingCost,
  buildEliteBuildingCost,
  buildOfficialArenaComplexRecipes,
  buildOfficialArenaResourceOutputs,
} from "../common/arena/shared";

const BLITZ_DURATION_MINUTES = 60;
const BLITZ_DURATION_SECONDS = BLITZ_DURATION_MINUTES * 60;

const blitzComplexBuildingCosts = {
  ...COMPLEX_BUILDING_COSTS,
  [BuildingType.ResourceAdamantine]: [
    { resource: ResourcesIds.Labor, amount: 240 },
    { resource: ResourcesIds.Wood, amount: 180 },
    { resource: ResourcesIds.Copper, amount: 120 },
    { resource: ResourcesIds.Ironwood, amount: 60 },
    { resource: ResourcesIds.Essence, amount: 300 },
  ],
  [BuildingType.ResourceMithral]: [
    { resource: ResourcesIds.Labor, amount: 240 },
    { resource: ResourcesIds.Wood, amount: 180 },
    { resource: ResourcesIds.Copper, amount: 120 },
    { resource: ResourcesIds.ColdIron, amount: 60 },
    { resource: ResourcesIds.Essence, amount: 300 },
  ],
  [BuildingType.ResourceDragonhide]: [
    { resource: ResourcesIds.Labor, amount: 240 },
    { resource: ResourcesIds.Wood, amount: 180 },
    { resource: ResourcesIds.Copper, amount: 120 },
    { resource: ResourcesIds.Gold, amount: 60 },
    { resource: ResourcesIds.Essence, amount: 300 },
  ],
  [BuildingType.ResourceKnightT2]: buildComplexBuildingCost(ResourcesIds.ColdIron, 300),
  [BuildingType.ResourceCrossbowmanT2]: buildComplexBuildingCost(ResourcesIds.Ironwood, 300),
  [BuildingType.ResourcePaladinT2]: buildComplexBuildingCost(ResourcesIds.Gold, 300),
  [BuildingType.ResourceKnightT3]: buildEliteBuildingCost(ResourcesIds.ColdIron, ResourcesIds.Mithral, 600),
  [BuildingType.ResourceCrossbowmanT3]: buildEliteBuildingCost(ResourcesIds.Ironwood, ResourcesIds.Adamantine, 600),
  [BuildingType.ResourcePaladinT3]: buildEliteBuildingCost(ResourcesIds.Gold, ResourcesIds.Dragonhide, 600),
};

const blitzSimpleBuildingCosts = {
  ...SIMPLE_BUILDING_COSTS,
  [BuildingType.ResourceCoal]: [{ resource: ResourcesIds.Labor, amount: 150 }],
  [BuildingType.ResourceCopper]: [{ resource: ResourcesIds.Labor, amount: 540 }],
  [BuildingType.ResourceIronwood]: [{ resource: ResourcesIds.Labor, amount: 1320 }],
  [BuildingType.ResourceColdIron]: [{ resource: ResourcesIds.Labor, amount: 1320 }],
  [BuildingType.ResourceGold]: [{ resource: ResourcesIds.Labor, amount: 1320 }],
  [BuildingType.ResourceDonkey]: [{ resource: ResourcesIds.Labor, amount: 300 }],
  [BuildingType.WorkersHut]: [{ resource: ResourcesIds.Labor, amount: 100 }],
};

const blitzRealmUpgradeCosts = {
  [RealmLevels.Settlement]: [],
  [RealmLevels.City]: [],
  [RealmLevels.Kingdom]: [
    { resource: ResourcesIds.Labor, amount: 720 },
    { resource: ResourcesIds.Wheat, amount: 2_400 },
    { resource: ResourcesIds.Essence, amount: 600 },
    { resource: ResourcesIds.Wood, amount: 360 },
  ],
  [RealmLevels.Empire]: [
    { resource: ResourcesIds.Labor, amount: 1_440 },
    { resource: ResourcesIds.Wheat, amount: 4_800 },
    { resource: ResourcesIds.Essence, amount: 1_200 },
    { resource: ResourcesIds.Wood, amount: 720 },
    { resource: ResourcesIds.Coal, amount: 360 },
    { resource: ResourcesIds.Copper, amount: 360 },
  ],
};

const blitzStartingResources = buildArenaStartingResources({
  [ResourcesIds.Wheat]: 1_000,
  [ResourcesIds.Labor]: 1_500,
  [ResourcesIds.Wood]: 360,
  [ResourcesIds.Coal]: 240,
  [ResourcesIds.Copper]: 120,
  [ResourcesIds.Donkey]: 500,
});

// Percents of the army's strength up to the 3,000 cap: an army at the cap finds 150, 300 or 600 Essence, 300 or 600
// labor, or 300 donkeys.
const blitzExplorationRewards = [
  { rewardId: ResourcesIds.Essence, percent: 5, probabilityBps: 3_500 },
  { rewardId: ResourcesIds.Essence, percent: 10, probabilityBps: 2_500 },
  { rewardId: ResourcesIds.Essence, percent: 20, probabilityBps: 1_500 },
  { rewardId: ResourcesIds.Labor, percent: 10, probabilityBps: 1_500 },
  { rewardId: ResourcesIds.Labor, percent: 20, probabilityBps: 500 },
  { rewardId: ResourcesIds.Donkey, percent: 10, probabilityBps: 500 },
] as const;

function buildBlitzResourceOutputs() {
  return {
    ...buildOfficialArenaResourceOutputs(2),
    [ResourcesIds.Donkey]: 3,
    [ResourcesIds.Essence]: 20,
  };
}

// Moving and exploring cost the same wheat per troop, so big armies need farms while scouts stay cheap.
const blitzStaminaConfig = {
  staminaInitial: 30,
  staminaGainPerTick: 30,
  staminaTravelWheatCost: 0.05,
  staminaExploreWheatCost: 0.05,
};

export const blitzVictoryPointConfig = {
  pointsForTileExploration: 5n * BigInt(VICTORY_POINTS_MULTIPLIER),
  pointsForNonHyperstructureClaimAgainstBandits: 250n * BigInt(VICTORY_POINTS_MULTIPLIER),
  pointsForRelicDiscovery: 250n * BigInt(VICTORY_POINTS_MULTIPLIER),
  pointsForHyperstructureClaimAgainstBandits: 1_000n * BigInt(VICTORY_POINTS_MULTIPLIER),
};

export const blitzBalance: ConfigPatch = {
  mines: {
    kinds: { 1: { productionRate: 10 } },
  },
  season: {
    durationSeconds: BLITZ_DURATION_SECONDS,
  },
  blitz: {
    exploration: {
      rewards: [...blitzExplorationRewards],
    },
  },
  resources: {
    productionByComplexRecipe: buildOfficialArenaComplexRecipes(2),
    productionByComplexRecipeOutputs: buildBlitzResourceOutputs(),
  },
  troop: {
    stamina: blitzStaminaConfig,
    // A reveal pays on at most 3,000 strength: explore with small armies, fight with big ones.
    limit: {
      exploreRewardStrengthCap: 3_000,
      lightGuardLowerBound: 999,
      lightGuardUpperBound: 1_499,
      heavyGuardLowerBound: 1_499,
      heavyGuardUpperBound: 1_999,
    },
  },
  victoryPoints: blitzVictoryPointConfig,
  buildings: {
    complexBuildingCosts: blitzComplexBuildingCosts,
    simpleBuildingCost: blitzSimpleBuildingCosts,
  },
  realmUpgradeCosts: blitzRealmUpgradeCosts,
  startingResources: blitzStartingResources,
  campStartingResources: [
    { resource: ResourcesIds.Wheat, min_amount: 500, max_amount: 500 },
    { resource: ResourcesIds.Labor, min_amount: 5_000, max_amount: 5_000 },
    { resource: ResourcesIds.Donkey, min_amount: 1_000, max_amount: 1_000 },
  ],
  // Half of Blitz's labor rate, the rate its camps produced at under the village rule.
  campLaborPerSecond: 1,
};
