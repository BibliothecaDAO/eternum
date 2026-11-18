import { orders, ResourcesIds } from "../../../packages/types/src/constants";
import { nativeCommandBits } from "../../../contracts/l3/world-native/schema/commands.gen";
import { nativeResearchConstants as research } from "../../../contracts/l3/world-native/schema/client.gen";
import { nativeRuleConstants as rules } from "../../../contracts/l3/world-native/schema/client.gen";
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
      limit: { exploreRewardStrengthCap: 10000 },
    },
    resources: {
      productionBySimpleRecipe: { [ResourcesIds.Paladin]: [{ resource: ResourcesIds.Wheat, amount: 2 }] },
      productionBySimpleRecipeOutputs: { [ResourcesIds.Paladin]: 1 },
      productionByComplexRecipeOutputs: { [ResourcesIds.Paladin]: 100 / 3600, [ResourcesIds.Knight]: 100 / 3600 },
    },
    buildings: {
      simpleBuildingCost: { [research.SCOUTS_LODGE]: [{ resource: ResourcesIds.Labor, amount: 500 }] },
    },
    startingResources: [
      { resource: ResourcesIds.Knight, amount: 3000 },
      { resource: ResourcesIds.Wheat, amount: 6000 },
      { resource: ResourcesIds.Labor, amount: 2000 },
    ],
  },
  orderAspects,
  depths: frontierPreset.depths.map((depth, index) => ({
    ...depth,
    siteGuardLower: 1170 * 2 ** index,
    siteGuardUpper: 1430 * 2 ** index,
    guardStep: 10,
    beastWeakLower: 315 * 2 ** index,
    beastWeakUpper: 385 * 2 ** index,
    beastStrongLower: 405 * 2 ** index,
    beastStrongUpper: 495 * 2 ** index,
    chest: layerRuinOdds[index] ?? depth.chest,
  })),
  labor: null,
  discovery: { ...frontierPreset.discovery, beastsBps: 900 },
  dailyQuest: { baseCounts: [1, 1, 1, 1, 1, 2, 15], labor: 1000, essence: 1500, bonusPercent: 150 },
  banes: {
    chanceStep: 20,
    quorumPercent: 25,
    beastPercent: 150,
    staminaPercent: 50,
    productionPercent: 50,
    questCounts: [3, 6, 9, 12, 20, 40, 60, 80, 2500, 6000, 10000, 15000],
  },
  deep: {
    foundation: { x: 25, y: 35 },
    quarry: { x: 12, y: 20 },
    altar: { x: 38, y: 20 },
    beastCount: 10000,
    lossPerTick: 100,
    quarryPerTick: 500,
    altarPerTick: 5,
    altarThreshold: 1500,
  },
  race: {
    seasonDays: 50,
    gloryPerTick: 5,
    heightPerTick: 5,
    stageHeight: 2000,
    clearMistPercent: 200,
    secondWindPercent: 200,
    paleMoonPercent: 50,
    spoilsPercent: 200,
  },
  modeRules: (frontierPreset.modeRules | rules.DISCOVER_SPIRES) & ~rules.DISCOVER_CHESTS,
  chests: null,
  commandMask:
    (frontierPreset.commandMask |
      BigInt(nativeCommandBits.ApplyRelic) |
      BigInt(nativeCommandBits.Battle) |
      BigInt(nativeCommandBits.ClaimDailyQuest)) &
    ~BigInt(nativeCommandBits.OpenRelicChest),
} satisfies NativePreset;
