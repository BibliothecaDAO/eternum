import { frontierPreset } from "./native";
import { nativeResearchConstants as research } from "../../../contracts/l3/world-native/schema/client.gen";
import { CapacityConfig, RESOURCE_PRECISION } from "../../../packages/types/src/constants";
import type { ConfigPatch } from "../common/merge-config";
import { mergeConfigPatches } from "../common/merge-config";
import { arenaBaseConfig } from "../common/arena/base";

const resourceIds = Array.from({ length: 58 }, (_, index) => index + 1);
const buildingIds = Array.from({ length: research.HEARTH }, (_, index) => index + 1);
const trainingBuildings = [research.WAR_HALL, research.SUPPLY_YARD, research.SCOUTS_LODGE, research.HEARTH];
const laborCosts: Record<number, number> = {
  [research.HUT]: 300,
  2: 1000,
  [research.WORKSHOP]: 2000,
  [research.BARRACKS]: 400,
  [research.FARM]: 400,
  ...Object.fromEntries(trainingBuildings.map((category) => [category, 3000])),
};
const populationCosts: Record<number, number> = {
  [research.HUT]: 0,
  [research.BARRACKS]: 3,
  [research.FARM]: 1,
};
// One troop type: Barracks make Knight T1 (resource 26) and nothing else.
const rates: Record<number, number> = {
  23: 100 / 3600,
  26: 100 / 3600,
  35: 300 / 3600,
};
const buildingCosts = Object.fromEntries(
  buildingIds.map((id) => [id, laborCosts[id] === undefined ? [] : [{ resource: 23, amount: laborCosts[id] }]]),
);
// Barracks train from nothing. A troop's recipe is what its realm pays, per troop, to raise it into an army.
const troopRaiseCosts = Object.fromEntries(
  resourceIds.map((id) => [id, id === 26 ? [{ resource: 35, amount: 2 }] : []]),
);

// Combat keeps the existing troop formula; the board and economy use Frontier's sheet.
export const frontierBaseConfig: ConfigPatch = mergeConfigPatches(arenaBaseConfig, {
  presetId: frontierPreset.id,
  blitz: {
    registration: { registration_count_max: 0 },
    exploration: { rewards: [] },
  },
  dev: { mode: { on: false } },
  season: {
    durationSeconds: frontierPreset.chests!.seasonEpochs * frontierPreset.epochSeconds,
    endGraceSeconds: 0,
    startSettlingAfterSeconds: 0,
    startMainAfterSeconds: 0,
  },
  tick: { armiesTickIntervalInSeconds: 120 },
  battle: { cooldownSeconds: 0, regularImmunityTicks: 0, villageImmunityTicks: 0, delaySeconds: 0 },
  startingResources: [
    { resource: 26, amount: 1500 },
    { resource: 35, amount: 1000 },
    { resource: 23, amount: 2000 },
  ],
  villageStartingResources: [],
  campStartingResources: [],
  resources: {
    resourcePrecision: RESOURCE_PRECISION,
    productionBySimpleRecipe: troopRaiseCosts,
    productionBySimpleRecipeOutputs: Object.fromEntries(resourceIds.map((id) => [id, id === 26 ? 1 : 0])),
    productionByComplexRecipe: Object.fromEntries(resourceIds.map((id) => [id, []])),
    productionByComplexRecipeOutputs: Object.fromEntries(resourceIds.map((id) => [id, rates[id] ?? 0])),
    resourceWeightsGrams: Object.fromEntries(
      resourceIds.map((id) => [id, id === 23 || id === 35 || (id >= 26 && id <= 34) ? 1 : 0]),
    ),
  },
  buildings: {
    // A copy costs its base times 1 + (copies - 1)^2: a surcharge of 1.0, in basis points.
    buildingFixedCostScalePercent: 10000,
    buildingPopulation: Object.fromEntries(buildingIds.map((id) => [id, populationCosts[id] ?? 2])),
    buildingCapacity: Object.fromEntries(buildingIds.map((id) => [id, id === research.HUT ? 6 : 0])),
    simpleBuildingCost: buildingCosts,
    complexBuildingCosts: Object.fromEntries(buildingIds.map((id) => [id, []])),
  },
  carryCapacityGram: {
    [CapacityConfig.RealmStructure]: 20000,
    [CapacityConfig.Storehouse]: 10000,
  },
  realmMaxLevel: 4,
  villageMaxLevel: 1,
  realmUpgradeCosts: {
    1: [{ resource: 23, amount: 4000 }],
    2: [{ resource: 23, amount: 15000 }],
    3: [{ resource: 23, amount: 40000 }],
  },
  troop: {
    // One troop type fights here, so terrain would only add noise: Frontier combat is biome-neutral.
    damage: { damageBiomeBonusNum: 0 },
    stamina: {
      damageStaminaRefund: false,
      captureStaminaRefund: 0,
      staminaGainPerTick: 1,
      staminaInitial: 150,
      staminaBonusValue: 0,
      staminaKnightMax: 150,
      staminaCrossbowmanMax: 150,
      staminaPaladinMax: 150,
      staminaAttackReq: 30,
      staminaDefenseReq: 40,
      staminaExploreStaminaCost: 30,
      staminaTravelStaminaCost: 10,
      staminaExploreWheatCost: 0.02,
      staminaTravelWheatCost: 0.02,
      staminaExploreFishCost: 0,
      staminaTravelFishCost: 0,
    },
    limit: {
      settlementArmies: 3,
      cityArmies: 4,
      kingdomArmies: 5,
      empireArmies: 6,
      settlementGuardSlots: 0,
      cityGuardSlots: 0,
      kingdomGuardSlots: 0,
      empireGuardSlots: 0,
      startingGuard: 0,
      campArmies: 0,
      settlementDeploymentCap: 3000,
      cityDeploymentCap: 9000,
      kingdomDeploymentCap: 25000,
      empireDeploymentCap: 60000,
      t1TierModifier: 100,
      // Troop tiers are gone from Frontier: a T2 or T3 army has room for no troops.
      t2TierModifier: 0,
      t3TierModifier: 0,
    },
  },
  exploration: {
    shardsMinesWinProbability: 0,
    shardsMinesFailProbability: 1,
    campFindProbability: 0,
    campFindFailProbability: 1,
    bitcoinMineWinProbability: 0,
    bitcoinMineFailProbability: 1,
    hyperstructureWinProbAtCenter: 0,
    hyperstructureFailProbAtCenter: 1,
    relicDiscoveryIntervalSeconds: 0,
    relicChestRelicsPerChest: 1,
  },
  mines: {
    kinds: {
      1: { resourceType: 38, buildingCategory: 39, productionRate: 5000 / 86400, capMinimum: 3000, capSteps: 1 },
    },
    surfacePool: [{ kind: 1, weight: 1 }],
  },
  victoryPoints: {
    hyperstructurePointsPerCycle: 0n,
    pointsForHyperstructureClaimAgainstBandits: 0n,
    pointsForNonHyperstructureClaimAgainstBandits: 0n,
    pointsForTileExploration: 0n,
    pointsForRelicDiscovery: 0n,
    pointsForWin: 0n,
  },
});
