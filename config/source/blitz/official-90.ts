import { ResourcesIds } from "../../../packages/types/src/constants";
import { COMPLEX_BUILDING_COSTS, SIMPLE_BUILDING_COSTS } from "./building";
import { REALM_UPGRADE_COSTS } from "./levels";
import type { BlitzBalanceProfile } from "./shared";
import {
  buildBlitzStartingResources,
  buildOfficialBlitzComplexRecipes,
  buildOfficialBlitzLaborOutputs,
  buildOfficialBlitzResourceOutputs,
  buildOfficialBlitzSimpleRecipes,
} from "./shared";

export const OFFICIAL_90_BLITZ_DURATION_MINUTES = 90;
export const OFFICIAL_90_BLITZ_DURATION_SECONDS = OFFICIAL_90_BLITZ_DURATION_MINUTES * 60;

const official90BlitzStartingResources = buildBlitzStartingResources(
  {
    [ResourcesIds.Wheat]: 1_000,
    [ResourcesIds.Labor]: 1_200,
    [ResourcesIds.Wood]: 180,
    [ResourcesIds.Coal]: 120,
    [ResourcesIds.Copper]: 60,
    [ResourcesIds.Donkey]: 200,
  },
  3_000,
);

const official90BlitzExplorationRewards = [
  { rewardId: ResourcesIds.Essence, amount: 100, probabilityBps: 3_000 },
  { rewardId: ResourcesIds.Essence, amount: 250, probabilityBps: 2_000 },
  { rewardId: ResourcesIds.Essence, amount: 500, probabilityBps: 1_500 },
  { rewardId: ResourcesIds.Labor, amount: 250, probabilityBps: 1_500 },
  { rewardId: ResourcesIds.Labor, amount: 500, probabilityBps: 800 },
  { rewardId: ResourcesIds.Donkey, amount: 100, probabilityBps: 600 },
  { rewardId: ResourcesIds.Knight, amount: 1_000, probabilityBps: 200 },
  { rewardId: ResourcesIds.Crossbowman, amount: 1_000, probabilityBps: 200 },
  { rewardId: ResourcesIds.Paladin, amount: 1_000, probabilityBps: 200 },
] as const;

export const official90BlitzProfile: BlitzBalanceProfile = {
  season: {
    durationSeconds: OFFICIAL_90_BLITZ_DURATION_SECONDS,
  },
  blitz: {
    exploration: {
      rewardProfileId: "official-90",
      rewards: [...official90BlitzExplorationRewards],
    },
  },
  resources: {
    productionByComplexRecipe: buildOfficialBlitzComplexRecipes(1),
    productionByComplexRecipeOutputs: buildOfficialBlitzResourceOutputs(1, 3),
    productionBySimpleRecipe: buildOfficialBlitzSimpleRecipes(1),
    productionBySimpleRecipeOutputs: buildOfficialBlitzResourceOutputs(1, 3),
    laborOutputPerResource: buildOfficialBlitzLaborOutputs(1),
  },
  buildings: {
    complexBuildingCosts: COMPLEX_BUILDING_COSTS,
    simpleBuildingCost: SIMPLE_BUILDING_COSTS,
  },
  realmUpgradeCosts: REALM_UPGRADE_COSTS,
  startingResources: official90BlitzStartingResources,
  discoverableVillageStartingResources: [
    { resource: ResourcesIds.Wheat, min_amount: 500, max_amount: 500 },
    { resource: ResourcesIds.Labor, min_amount: 2_500, max_amount: 2_500 },
    { resource: ResourcesIds.Donkey, min_amount: 200, max_amount: 200 },
  ],
};
