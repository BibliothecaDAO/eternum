import { BuildingType, RealmLevels, ResourcesIds } from "../../../packages/types/src/constants";
import { COMPLEX_BUILDING_COSTS, SIMPLE_BUILDING_COSTS } from "./building";
import type { BlitzBalanceProfile } from "./shared";
import {
  buildBlitzStartingResources,
  buildComplexBuildingCost,
  buildEliteBuildingCost,
  buildOfficialBlitzComplexRecipes,
  buildOfficialBlitzLaborOutputs,
  buildOfficialBlitzResourceOutputs,
  buildOfficialBlitzSimpleRecipes,
} from "./shared";

export const OFFICIAL_60_BLITZ_DURATION_MINUTES = 60;
export const OFFICIAL_60_BLITZ_DURATION_SECONDS = OFFICIAL_60_BLITZ_DURATION_MINUTES * 60;

const official60BlitzComplexBuildingCosts = {
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

const official60BlitzSimpleBuildingCosts = {
  ...SIMPLE_BUILDING_COSTS,
  [BuildingType.ResourceCoal]: [{ resource: ResourcesIds.Labor, amount: 150 }],
  [BuildingType.ResourceCopper]: [{ resource: ResourcesIds.Labor, amount: 540 }],
  [BuildingType.ResourceIronwood]: [{ resource: ResourcesIds.Labor, amount: 1320 }],
  [BuildingType.ResourceColdIron]: [{ resource: ResourcesIds.Labor, amount: 1320 }],
  [BuildingType.ResourceGold]: [{ resource: ResourcesIds.Labor, amount: 1320 }],
  [BuildingType.ResourceDonkey]: [{ resource: ResourcesIds.Labor, amount: 300 }],
  [BuildingType.WorkersHut]: [{ resource: ResourcesIds.Labor, amount: 100 }],
};

const official60BlitzRealmUpgradeCosts = {
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

const official60BlitzStartingResources = buildBlitzStartingResources(
  {
    [ResourcesIds.Wheat]: 1_000,
    [ResourcesIds.Labor]: 1_500,
    [ResourcesIds.Wood]: 360,
    [ResourcesIds.Coal]: 240,
    [ResourcesIds.Copper]: 120,
    [ResourcesIds.Donkey]: 500,
  },
  5_000,
);

const official60BlitzExplorationRewards = [
  { rewardId: ResourcesIds.Essence, amount: 150, probabilityBps: 3_500 },
  { rewardId: ResourcesIds.Essence, amount: 300, probabilityBps: 2_500 },
  { rewardId: ResourcesIds.Essence, amount: 600, probabilityBps: 1_500 },
  { rewardId: ResourcesIds.Labor, amount: 500, probabilityBps: 1_500 },
  { rewardId: ResourcesIds.Labor, amount: 1_000, probabilityBps: 500 },
  { rewardId: ResourcesIds.Donkey, amount: 500, probabilityBps: 500 },
] as const;

export const official60BlitzProfile: BlitzBalanceProfile = {
  season: {
    durationSeconds: OFFICIAL_60_BLITZ_DURATION_SECONDS,
  },
  blitz: {
    exploration: {
      rewardProfileId: "official-60",
      rewards: [...official60BlitzExplorationRewards],
    },
  },
  resources: {
    productionByComplexRecipe: buildOfficialBlitzComplexRecipes(2),
    productionByComplexRecipeOutputs: buildOfficialBlitzResourceOutputs(2, 5),
    productionBySimpleRecipe: buildOfficialBlitzSimpleRecipes(2),
    productionBySimpleRecipeOutputs: buildOfficialBlitzResourceOutputs(2, 5),
    laborOutputPerResource: buildOfficialBlitzLaborOutputs(2),
  },
  buildings: {
    complexBuildingCosts: official60BlitzComplexBuildingCosts,
    simpleBuildingCost: official60BlitzSimpleBuildingCosts,
  },
  realmUpgradeCosts: official60BlitzRealmUpgradeCosts,
  startingResources: official60BlitzStartingResources,
  discoverableVillageStartingResources: [
    { resource: ResourcesIds.Wheat, min_amount: 500, max_amount: 500 },
    { resource: ResourcesIds.Labor, min_amount: 5_000, max_amount: 5_000 },
    { resource: ResourcesIds.Donkey, min_amount: 1_000, max_amount: 1_000 },
  ],
};
