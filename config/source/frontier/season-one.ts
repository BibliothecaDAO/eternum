import { DAYS_PER_BAG, DAY_UNITS_PER_BAG } from "../../../packages/core/src/utils/days";
import { ResourcesIds, orders, dailyQuests } from "../../../packages/types/src/constants";
import type { NativePreset } from "../common/native-preset";
import { FRONTIER_S1_PRESET_ID, FRONTIER_S1_DEV_PRESET_ID } from "../common/native-preset-modes";
import { FRONTIER_DAY_UNIT_SECONDS } from "./clock";
import { frontierPreset } from "./native";
import { BuildingType } from "../../../packages/types/src/constants";
import { nativeCommandBits } from "../../../contracts/l3/world-native/schema/commands.gen";
import {
  nativeResearchConstants as research,
  nativeRuleConstants as rules,
} from "../../../contracts/l3/world-native/schema/client.gen";

const race = {
  seasonDays: 50,
  gloryPerTick: 5,
  heightPerTick: 5,
  stageHeight: 2_000,
  clearMistPercent: 200,
  secondWindPercent: 200,
  paleMoonPercent: 50,
  spoilsPercent: 200,
  positions: [
    [10, 10],
    [40, 10],
    [10, 40],
    [40, 40],
  ],
} satisfies NonNullable<NativePreset["race"]>;

export const frontierSeasonOnePreset: NativePreset & {
  worldBanes: NonNullable<NativePreset["worldBanes"]>;
  dailyQuest: NonNullable<NativePreset["dailyQuest"]>;
} = {
  ...frontierPreset,
  id: FRONTIER_S1_PRESET_ID,
  startingArmyCount: 2,
  board: {
    ...frontierPreset.board!,
    town: { laborStoreCaps: [5_000, 15_000, 50_000, 100_000] },
    trainingGateTier: 0,
    workshopRate: 200 / 3600,
  },
  labor: null,
  dailyQuest: {
    baseCounts: dailyQuests.map(({ baseCount }) => baseCount),
    labor: 1_000,
    essence: 1_500,
    bonusPercent: 150,
  },
  worldBanes: {
    chanceStep: 20,
    quorumPercent: 25,
    beastPercent: 150,
    staminaPercent: 50,
    productionPercent: 50,
    questCounts: [3, 6, 9, 12, 20, 40, 60, 80, 2_500, 6_000, 10_000, 15_000],
  },
  orderAspects: orders.filter(({ aspect }) => aspect !== null).map(({ aspect }) => aspect!),
  modeRules: (frontierPreset.modeRules | rules.DISCOVER_SPIRES) & ~(rules.DISCOVER_CHESTS | rules.SEASON_CLOSE),
  chests: null,
  race,
  deep: {
    foundation: { x: 25, y: 35 },
    quarry: { x: 12, y: 20 },
    altar: { x: 38, y: 20 },
    beastCount: 10_000,
    lossPerTick: 200,
    quarryPerTick: 500,
    altarPerTick: 5,
    altarThreshold: 1_500,
  },
  commandMask:
    (frontierPreset.commandMask |
      BigInt(nativeCommandBits.Battle) |
      BigInt(nativeCommandBits.ApplyRelic) |
      BigInt(nativeCommandBits.ClaimDailyQuest)) &
    ~(
      BigInt(nativeCommandBits.OpenRelicChest) |
      BigInt(nativeCommandBits.RefillStamina) |
      BigInt(nativeCommandBits.WithdrawLords)
    ),
  depths: frontierPreset.depths.map((depth, index) =>
    index === 1 ? { ...depth, chest: { common: 0, uncommon: 5_000, rare: 2_800, epic: 1_500, legendary: 700 } } : depth,
  ),
  research: [
    ...frontierPreset.research.filter(
      ({ row }) => row !== research.ROW_WELL && row !== research.ROW_SHRINE && row !== research.ROW_DEPTH,
    ),
    { row: research.ROW_WELL, tier: 1, essenceCost: 2_500, laborCost: 0 },
    { row: research.ROW_SHRINE, tier: 1, essenceCost: 5_000, laborCost: 0 },
    { row: research.ROW_DEPTH, tier: 1, essenceCost: 10_000, laborCost: 0 },
  ],
  balance: {
    realmUpgradeCosts: {
      1: [{ resource: ResourcesIds.Labor, amount: 2_500 }],
      2: [{ resource: ResourcesIds.Labor, amount: 15_000 }],
      3: [{ resource: ResourcesIds.Labor, amount: 50_000 }],
    },
    resources: {
      productionByComplexRecipeOutputs: {
        [ResourcesIds.Labor]: 100 / 3600,
        [ResourcesIds.Wheat]: 300 / 3600,
        [ResourcesIds.Knight]: 100 / 3600,
      },
    },
    buildings: {
      simpleBuildingCost: {
        [BuildingType.Storehouse]: [{ resource: ResourcesIds.Labor, amount: 10_000 }],
        [research.WORKSHOP]: [{ resource: ResourcesIds.Labor, amount: 1_000 }],
        [research.FARM]: [{ resource: ResourcesIds.Labor, amount: 500 }],
        [research.BARRACKS]: [{ resource: ResourcesIds.Labor, amount: 500 }],
      },
    },
    season: { durationSeconds: (race.seasonDays / DAYS_PER_BAG) * DAY_UNITS_PER_BAG * FRONTIER_DAY_UNIT_SECONDS },
    troop: {
      stamina: {
        staminaInitial: 180,
        staminaKnightMax: 180,
        staminaCrossbowmanMax: 180,
        staminaPaladinMax: 180,
        staminaDefenseReq: 0,
      },
    },
    startingResources: [
      { resource: ResourcesIds.Knight, amount: 3_000 },
      { resource: ResourcesIds.Wheat, amount: 6_000 },
      { resource: ResourcesIds.Labor, amount: 2_000 },
    ],
  },
};

export const frontierSeasonOneDevPreset: NativePreset = {
  ...frontierSeasonOnePreset,
  id: FRONTIER_S1_DEV_PRESET_ID,
  worldBanes: {
    ...frontierSeasonOnePreset.worldBanes,
    questCounts: frontierSeasonOnePreset.worldBanes.questCounts.map((count, index, counts) =>
      index % 4 > 1 ? counts[index - (index % 4) + 1] : count,
    ),
  },
};
