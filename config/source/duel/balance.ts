import { ResourcesIds } from "../../../packages/types/src/constants";
import { COMPLEX_BUILDING_COSTS, SIMPLE_BUILDING_COSTS } from "../common/arena/building";
import { REALM_UPGRADE_COSTS } from "../common/arena/levels";
import type { ConfigPatch } from "../common/merge-config";
import {
  buildArenaStartingResources,
  buildOfficialArenaComplexRecipes,
  buildOfficialArenaResourceOutputs,
} from "../common/arena/shared";

const DUEL_DURATION_MINUTES = 90;
const DUEL_DURATION_SECONDS = DUEL_DURATION_MINUTES * 60;

const duelStartingResources = buildArenaStartingResources({
  [ResourcesIds.Wheat]: 1_000,
  [ResourcesIds.Labor]: 1_200,
  [ResourcesIds.Wood]: 180,
  [ResourcesIds.Coal]: 120,
  [ResourcesIds.Copper]: 60,
  [ResourcesIds.Donkey]: 200,
});

// A 1,000-troop T1 army earns what the fixed pool paid.
const duelExplorationRewards = [
  { rewardId: ResourcesIds.Essence, percent: 10, probabilityBps: 3_000 },
  { rewardId: ResourcesIds.Essence, percent: 25, probabilityBps: 2_000 },
  { rewardId: ResourcesIds.Essence, percent: 50, probabilityBps: 1_500 },
  { rewardId: ResourcesIds.Labor, percent: 25, probabilityBps: 1_500 },
  { rewardId: ResourcesIds.Labor, percent: 50, probabilityBps: 800 },
  { rewardId: ResourcesIds.Donkey, percent: 10, probabilityBps: 600 },
  { rewardId: ResourcesIds.Knight, percent: 100, probabilityBps: 200 },
  { rewardId: ResourcesIds.Crossbowman, percent: 100, probabilityBps: 200 },
  { rewardId: ResourcesIds.Paladin, percent: 100, probabilityBps: 200 },
] as const;

export const duelBalance: ConfigPatch = {
  mines: { kinds: { 1: { productionRate: 5 } } },
  season: {
    durationSeconds: DUEL_DURATION_SECONDS,
  },
  blitz: {
    exploration: {
      rewards: [...duelExplorationRewards],
    },
  },
  resources: {
    productionByComplexRecipe: buildOfficialArenaComplexRecipes(1),
    productionByComplexRecipeOutputs: buildOfficialArenaResourceOutputs(1),
  },
  buildings: {
    complexBuildingCosts: COMPLEX_BUILDING_COSTS,
    simpleBuildingCost: SIMPLE_BUILDING_COSTS,
  },
  realmUpgradeCosts: REALM_UPGRADE_COSTS,
  startingResources: duelStartingResources,
  campStartingResources: [
    { resource: ResourcesIds.Wheat, min_amount: 500, max_amount: 500 },
    { resource: ResourcesIds.Labor, min_amount: 2_500, max_amount: 2_500 },
    { resource: ResourcesIds.Donkey, min_amount: 200, max_amount: 200 },
  ],
};
