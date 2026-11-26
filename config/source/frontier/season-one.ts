import { FRAGMENT_SPEND_COMMANDS, orders, ResourcesIds } from "../../../packages/types/src/constants";
import { nativeCommandBits } from "../../../contracts/l3/world-native/schema/commands.gen";
import { nativeResearchConstants as research } from "../../../contracts/l3/world-native/schema/balance.gen";
import type { NativePreset } from "../common/native-preset";
import { FRONTIER_S1_PRESET_ID } from "../common/native-preset-modes";
import { frontierPreset } from "./native";

const layerRuinOdds = [
  { common: 6000, uncommon: 3000, rare: 1000, epic: 0, legendary: 0 },
  { common: 0, uncommon: 6000, rare: 3000, epic: 1000, legendary: 0 },
  { common: 0, uncommon: 0, rare: 6000, epic: 3000, legendary: 1000 },
];

const orderAspects: NativePreset["orderAspects"] = orders
  .filter(({ aspect }) => aspect !== null)
  .map(({ aspect }) => aspect!);

export const frontierSeasonOnePreset = {
  ...frontierPreset,
  id: FRONTIER_S1_PRESET_ID,
  balance: {
    troop: {
      stamina: {
        staminaInitial: 180,
        staminaKnightMax: 180,
        staminaCrossbowmanMax: 180,
        staminaPaladinMax: 180,
        staminaDefenseReq: 0,
      },
    },
    resources: {
      productionBySimpleRecipe: { [ResourcesIds.Paladin]: [{ resource: ResourcesIds.Wheat, amount: 2 }] },
      productionBySimpleRecipeOutputs: { [ResourcesIds.Paladin]: 1 },
      productionByComplexRecipeOutputs: {
        [ResourcesIds.Paladin]: 120 / 3600,
        [ResourcesIds.Knight]: 120 / 3600,
        [ResourcesIds.Labor]: 120 / 3600,
        [ResourcesIds.Wheat]: 240 / 3600,
      },
    },
    buildings: {
      simpleBuildingCost: {
        [research.FARM]: [{ resource: ResourcesIds.Labor, amount: 500 }],
        [research.BARRACKS]: [{ resource: ResourcesIds.Labor, amount: 1000 }],
        [research.SCOUTS_LODGE]: [{ resource: ResourcesIds.Labor, amount: 1000 }],
        [research.WORKSHOP]: [{ resource: ResourcesIds.Labor, amount: 1000 }],
        [research.STOREROOM]: [{ resource: ResourcesIds.Labor, amount: 10000 }],
        [research.CONSCRIPTION_CAMP]: [
          { resource: ResourcesIds.Essence, amount: 2500 },
          { resource: ResourcesIds.Labor, amount: 500 },
        ],
        [research.RATIONS_DEPOT]: [
          { resource: ResourcesIds.Essence, amount: 5000 },
          { resource: ResourcesIds.Labor, amount: 1000 },
        ],
        [research.SUPPLY_YARD]: [
          { resource: ResourcesIds.Essence, amount: 5000 },
          { resource: ResourcesIds.Labor, amount: 1000 },
        ],
      },
    },
    startingResources: [
      { resource: ResourcesIds.Knight, amount: 2000 },
      { resource: ResourcesIds.Wheat, amount: 5000 },
      { resource: ResourcesIds.Labor, amount: 3000 },
    ],
    realmUpgradeCosts: {
      1: [{ resource: ResourcesIds.Labor, amount: 4000 }],
      2: [{ resource: ResourcesIds.Labor, amount: 12000 }],
      3: [{ resource: ResourcesIds.Labor, amount: 40000 }],
    },
  },
  orderAspects,
  depths: frontierPreset.depths.slice(0, layerRuinOdds.length).map((depth, index) => ({
    ...depth,
    siteGuardLower: 1170 * 2 ** index,
    siteGuardUpper: 1430 * 2 ** index,
    riftGuardLower: 1350 * 2 ** index,
    riftGuardUpper: 1650 * 2 ** index,
    guardStep: 10,
    beastWeakLower: 315 * 2 ** index,
    beastWeakUpper: 385 * 2 ** index,
    beastStrongLower: 405 * 2 ** index,
    beastStrongUpper: 495 * 2 ** index,
    chest: layerRuinOdds[index]!,
  })),
  board: {
    ...frontierPreset.board!,
    workshopRate: 120 / 3600,
    outputStepBps: 5000,
    storageStepBps: 10000,
    laborStoreCaps: [5000, 15000, 50000, 100000],
  },
  labor: null,
  dailyQuest: { baseCounts: [1, 1, 1, 1, 1, 2, 15], labor: 1000, essence: 1500, bonusPercent: 150 },
  banes: {
    quietDays: 3,
    chanceStep: 10,
    quorumPercent: 25,
    beastPercent: 150,
    staminaPercent: 50,
    productionPercent: 50,
    questCounts: [3, 6, 9, 12, 20, 40, 60, 80, 2500, 6000, 10000, 15000],
  },
  deep: {
    gateDistance: 24,
    rings: [
      { radius: 7, realms: 0 },
      { radius: 11, realms: 50 },
      { radius: 15, realms: 100 },
      { radius: 19, realms: 150 },
    ],
    beasts: {
      foundation: { count: 15000, bow: false },
      core: { count: 12000, bow: true },
      mine: { count: 10000, bow: false },
      altar: { count: 15000, bow: true },
    },
    lossPerTick: 200,
    corePerTick: 300,
    minePerTick: 300,
    buildingPay: { alone: 6, pair: 3, crowd: 2 },
    altarThreshold: 1500,
  },
  race: {
    seasonDays: 50,
    stageHeight: 2000,
    clearMistPercent: 200,
    secondWindPercent: 200,
    paleMoonPercent: 50,
    spoilsPercent: 200,
  },
  chests: null,
  commandMask:
    (frontierPreset.commandMask &
      ~FRAGMENT_SPEND_COMMANDS.reduce((mask, command) => mask | BigInt(nativeCommandBits[command]), 0n)) |
    BigInt(nativeCommandBits.ApplyRelic) |
    BigInt(nativeCommandBits.ClaimDailyQuest),
} satisfies NativePreset;
