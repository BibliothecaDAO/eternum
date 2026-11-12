import { ResourcesIds, orders } from "../../../packages/types/src/constants";
import type { NativePreset } from "../common/native-preset";
import { FRONTIER_S1_PRESET_ID } from "../common/native-preset-modes";
import { FRONTIER_DAY_UNIT_SECONDS } from "./clock";
import { frontierPreset } from "./native";
import { nativeCommandBits } from "../../../contracts/l3/world-native/schema/commands.gen";
import {
  nativeResearchConstants as research,
  nativeRuleConstants as rules,
} from "../../../contracts/l3/world-native/schema/client.gen";

export const frontierSeasonOnePreset = {
  ...frontierPreset,
  id: FRONTIER_S1_PRESET_ID,
  orderAspects: orders.filter(({ aspect }) => aspect !== null).map(({ aspect }) => aspect!),
  modeRules: (frontierPreset.modeRules | rules.DISCOVER_SPIRES) & ~rules.DISCOVER_CHESTS,
  chests: null,
  commandMask: frontierPreset.commandMask | BigInt(nativeCommandBits.ApplyRelic),
  depths: frontierPreset.depths.map((depth, index) =>
    index === 1 ? { ...depth, chest: { common: 0, uncommon: 5_000, rare: 2_800, epic: 1_500, legendary: 700 } } : depth,
  ),
  research: [
    ...frontierPreset.research.filter(({ row }) => row !== research.ROW_DEPTH),
    { row: research.ROW_DEPTH, tier: 1, essenceCost: 10_000, laborCost: 0 },
  ],
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
