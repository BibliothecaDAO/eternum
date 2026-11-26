import { FRONTIER_ARMIES_TICK_SECONDS } from "./clock";
import { buildingIds, FRONTIER_COST_GROWTH_BPS, frontierPreset } from "./native";
import { nativeResearchConstants as research } from "../../../contracts/l3/world-native/schema/balance.gen";
import { RESOURCE_PRECISION } from "../../../packages/types/src/constants";
import type { ConfigPatch } from "../common/merge-config";
import { mergeConfigPatches } from "../common/merge-config";
import { arenaBaseConfig } from "../common/arena/base";

const resourceIds = Array.from({ length: 58 }, (_, index) => index + 1);
const explicitBuildingCosts: Record<number, Array<{ resource: number; amount: number }>> = {
  [research.WORKSHOP]: [{ resource: 23, amount: 2000 }],
  [research.BARRACKS]: [{ resource: 23, amount: 400 }],
  [research.RANGE]: [{ resource: 23, amount: 1000 }],
  [research.FARM]: [{ resource: 23, amount: 400 }],
  [research.CONSCRIPTION_CAMP]: [
    { resource: 38, amount: 2500 },
    { resource: 23, amount: 500 },
  ],
  [research.RATIONS_DEPOT]: [
    { resource: 38, amount: 5000 },
    { resource: 23, amount: 1000 },
  ],
  [research.SUPPLY_YARD]: [
    { resource: 38, amount: 5000 },
    { resource: 23, amount: 1000 },
  ],
};
const rates: Record<number, number> = {
  23: 0.028,
  26: 0.028,
  29: 120 / 3600,
  35: 0.084,
};
const noPopulation = Object.fromEntries(buildingIds.map((id) => [id, 0]));
const buildingCosts = Object.fromEntries(buildingIds.map((id) => [id, explicitBuildingCosts[id] ?? []]));
// Barracks train from nothing. A troop's recipe is what its realm pays, per troop, to raise it into an army.
const troopRaiseCosts = Object.fromEntries(
  resourceIds.map((id) => [id, id === 26 || id === 29 ? [{ resource: 35, amount: 2 }] : []]),
);

// Combat keeps the existing troop formula; the board and economy use Frontier's sheet.
export const frontierBaseConfig: ConfigPatch = mergeConfigPatches(arenaBaseConfig, {
  presetId: frontierPreset.id,
  blitz: {
    registration: { registration_count_max: 0 },
  },
  dev: { mode: { on: false } },
  season: {
    // Unset until the operator supplies the calendar; the launch boundary refuses zero.
    durationSeconds: 0,
    startSettlingAfterSeconds: 0,
    startMainAfterSeconds: 0,
  },
  tick: { armiesTickIntervalInSeconds: FRONTIER_ARMIES_TICK_SECONDS },
  battle: { cooldownSeconds: 0, regularImmunityTicks: 0, villageImmunityTicks: 0, delaySeconds: 0 },
  startingResources: [
    { resource: 26, amount: 1500 },
    { resource: 35, amount: 4500 },
    { resource: 23, amount: 2000 },
  ],
  populationCapacity: { basePopulation: 0 },
  villageStartingResources: [],
  campStartingResources: [],
  resources: {
    resourcePrecision: RESOURCE_PRECISION,
    productionBySimpleRecipe: troopRaiseCosts,
    productionBySimpleRecipeOutputs: Object.fromEntries(resourceIds.map((id) => [id, id === 26 || id === 29 ? 1 : 0])),
    productionByComplexRecipe: Object.fromEntries(resourceIds.map((id) => [id, []])),
    productionByComplexRecipeOutputs: Object.fromEntries(resourceIds.map((id) => [id, rates[id] ?? 0])),
    resourceWeightsGrams: Object.fromEntries(
      resourceIds.map((id) => [id, id === 23 || id === 35 || (id >= 26 && id <= 34) ? 1 : 0]),
    ),
  },
  buildings: {
    // A copy costs its base times 1 + (copies - 1)^2: a surcharge of 1.0, in basis points.
    buildingFixedCostScalePercent: FRONTIER_COST_GROWTH_BPS,
    buildingPopulation: noPopulation,
    buildingCapacity: noPopulation,
    simpleBuildingCost: buildingCosts,
    complexBuildingCosts: Object.fromEntries(buildingIds.map((id) => [id, []])),
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
      staminaInitial: 120,
      staminaBonusValue: 0,
      staminaKnightMax: 120,
      staminaCrossbowmanMax: 120,
      staminaPaladinMax: 120,
      staminaAttackReq: 30,
      staminaDefenseReq: 40,
      staminaExploreStaminaCost: 20,
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
    hyperstructureWinProbAtCenter: 0,
    hyperstructureFailProbAtCenter: 1,
    relicDiscoveryIntervalSeconds: 0,
  },
  mines: {
    kinds: {
      1: { resourceType: 38, buildingCategory: 39, productionRate: 240 / 3600, capMinimum: 3000, capSteps: 1 },
    },
    surfacePool: [{ kind: 1, weight: 1 }],
  },
  victoryPoints: {
    hyperstructurePointsPerCycle: 0n,
    pointsForHyperstructureClaimAgainstBandits: 0n,
    pointsForNonHyperstructureClaimAgainstBandits: 0n,
    pointsForTileExploration: 0n,
    pointsForRelicDiscovery: 0n,
  },
});
