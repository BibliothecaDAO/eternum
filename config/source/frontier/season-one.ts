import { ResourcesIds, orders, dailyQuests } from "../../../packages/types/src/constants";
import type { NativePreset } from "../common/native-preset";
import { FRONTIER_S1_PRESET_ID } from "../common/native-preset-modes";
import { FRONTIER_DAY_UNIT_SECONDS } from "./clock";
import { frontierPreset } from "./native";
import { nativeCommandBits } from "../../../contracts/l3/world-native/schema/commands.gen";

export const frontierSeasonOnePreset = {
  ...frontierPreset,
  id: FRONTIER_S1_PRESET_ID,
  commandMask: frontierPreset.commandMask | BigInt(nativeCommandBits.ClaimDailyQuest),
  startingArmyCount: 2,
  labor: null,
  dailyQuest: {
    baseCounts: dailyQuests.map(({ baseCount }) => baseCount),
    labor: 1_000,
    essence: 1_500,
    bonusPercent: 150,
  },
  orderAspects: orders.filter(({ aspect }) => aspect !== null).map(({ aspect }) => aspect!),
  balance: {
    // Ten bags of five days; every bag has 2 + 3 + 4 + 5 + 6 day units.
    season: { durationSeconds: 10 * 20 * FRONTIER_DAY_UNIT_SECONDS },
    startingResources: [
      { resource: ResourcesIds.Knight, amount: 3_000 },
      { resource: ResourcesIds.Wheat, amount: 6_000 },
      { resource: ResourcesIds.Labor, amount: 2_000 },
    ],
  },
} satisfies NativePreset;
