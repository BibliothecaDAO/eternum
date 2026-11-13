import { ResourcesIds, orders, dailyQuests } from "../../../packages/types/src/constants";
import type { NativePreset } from "../common/native-preset";
import { FRONTIER_S1_PRESET_ID, FRONTIER_S1_DEV_PRESET_ID } from "../common/native-preset-modes";
import { FRONTIER_DAY_UNIT_SECONDS } from "./clock";
import { frontierPreset } from "./native";
import { nativeResearchConstants as research } from "../../../contracts/l3/world-native/schema/client.gen";
import { BuildingType } from "../../../packages/types/src/constants";
import { nativeCommandBits } from "../../../contracts/l3/world-native/schema/commands.gen";

export const frontierSeasonOnePreset: NativePreset & { worldBanes: NonNullable<NativePreset["worldBanes"]> } = {
  ...frontierPreset,
  id: FRONTIER_S1_PRESET_ID,
  commandMask: frontierPreset.commandMask | BigInt(nativeCommandBits.ClaimDailyQuest),
  startingArmyCount: 2,
  board: {
    ...frontierPreset.board!,
    town: { laborStoreCaps: [5_000, 15_000, 50_000, 100_000] },
    trainingGateTier: 0,
    workshopRate: 200 / 3600,
  },
  research: [
    ...frontierPreset.research.filter(
      ({ row }) => row !== research.ROW_WELL && row !== research.ROW_SHRINE && row !== research.ROW_DEPTH,
    ),
    { row: research.ROW_WELL, tier: 1, essenceCost: 2_500, laborCost: 0 },
    { row: research.ROW_SHRINE, tier: 1, essenceCost: 5_000, laborCost: 0 },
    { row: research.ROW_DEPTH, tier: 1, essenceCost: 10_000, laborCost: 0 },
  ],
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
  balance: {
    // Ten bags of five days; every bag has 2 + 3 + 4 + 5 + 6 day units.
    season: { durationSeconds: 10 * 20 * FRONTIER_DAY_UNIT_SECONDS },
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
