import { frontierPreset } from "./native";
import { CapacityConfig, RESOURCE_PRECISION } from "../../../packages/types/src/constants";
import type { ConfigPatch } from "../common/merge-config";
import { mergeConfigPatches } from "../common/merge-config";
import { arenaBaseConfig } from "../common/arena/base";

const resourceIds = Array.from({ length: 58 }, (_, index) => index + 1);
const buildingIds = Array.from({ length: 40 }, (_, index) => index + 1);
const laborCosts: Record<number, number> = { 1: 300, 2: 1000, 25: 1000, 28: 1200, 37: 100 };
const rates: Record<number, number> = {
  23: 100 / 3600,
  26: 100 / 3600,
  27: 250 / 3600,
  28: 250 / 3600,
  35: 200 / 3600,
};
const buildingCosts = Object.fromEntries(
  buildingIds.map((id) => [id, laborCosts[id] === undefined ? [] : [{ resource: 23, amount: laborCosts[id] }]]),
);
const trainingRecipes = Object.fromEntries(
  resourceIds.map((id) => [id, id >= 26 && id <= 34 ? [{ resource: 35, amount: 2 }] : []]),
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
    // The launch Worker's season calendar sets a live season's length; this is only the fallback for Frontier games
    // created outside it (the CLI and the harness).
    durationSeconds: 17 * 7 * 86400,
    endGraceSeconds: 0,
    startSettlingAfterSeconds: 0,
    startMainAfterSeconds: 0,
  },
  tick: { armiesTickIntervalInSeconds: 3600 },
  battle: { regularImmunityTicks: 0, villageImmunityTicks: 0, delaySeconds: 0 },
  startingResources: [
    { resource: 26, amount: 1500 },
    { resource: 35, amount: 1000 },
    { resource: 23, amount: 2000 },
  ],
  villageStartingResources: [],
  campStartingResources: [],
  resources: {
    resourcePrecision: RESOURCE_PRECISION,
    productionBySimpleRecipe: trainingRecipes,
    productionBySimpleRecipeOutputs: Object.fromEntries(resourceIds.map((id) => [id, id >= 26 && id <= 34 ? 1 : 0])),
    productionByComplexRecipe: Object.fromEntries(resourceIds.map((id) => [id, []])),
    productionByComplexRecipeOutputs: Object.fromEntries(resourceIds.map((id) => [id, rates[id] ?? 0])),
    resourceWeightsGrams: Object.fromEntries(
      resourceIds.map((id) => [id, id === 23 || id === 35 || (id >= 26 && id <= 34) ? 1 : 0]),
    ),
  },
  buildings: {
    buildingFixedCostScalePercent: 1500,
    buildingPopulation: Object.fromEntries(
      buildingIds.map((id) => [id, id === 1 || id === 25 ? 0 : id === 28 ? 3 : id === 37 ? 1 : 2]),
    ),
    buildingCapacity: Object.fromEntries(buildingIds.map((id) => [id, id === 1 ? 6 : 0])),
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
    1: [{ resource: 38, amount: 3000 }],
    2: [{ resource: 38, amount: 20000 }],
    3: [{ resource: 38, amount: 90000 }],
  },
  troop: {
    // One troop type fights here, so terrain would only add noise: Frontier combat is biome-neutral.
    damage: { damageBiomeBonusNum: 0 },
    stamina: {
      damageStaminaRefund: false,
      captureStaminaRefund: 0,
      staminaGainPerTick: 30,
      staminaInitial: 150,
      staminaBonusValue: 0,
      staminaKnightMax: 150,
      staminaCrossbowmanMax: 150,
      staminaPaladinMax: 150,
      staminaAttackReq: 50,
      staminaDefenseReq: 40,
      staminaExploreStaminaCost: 30,
      staminaTravelStaminaCost: 10,
      staminaExploreWheatCost: 0.03,
      staminaTravelWheatCost: 0.03,
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
    },
  },
  exploration: {
    // No rule reads an exploration reward amount; Frontier pays explores from its supplies table. Blitz, Eternum and
    // Duel keep theirs only because their registered presets commit it, and a changed definition could not launch.
    reward: 0,
    shardsMinesWinProbability: 4,
    shardsMinesFailProbability: 96,
    campFindProbability: 6,
    campFindFailProbability: 90,
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
