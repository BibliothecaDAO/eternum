import { DAYS_PER_BAG, DAY_UNITS_PER_BAG } from "../../../packages/core/src/utils/days";
import { ResourcesIds } from "../../../packages/types/src/constants";
import type { NativePreset } from "../common/native-preset";
import { FRONTIER_S1_PRESET_ID } from "../common/native-preset-modes";
import { FRONTIER_DAY_UNIT_SECONDS } from "./clock";
import { frontierPreset } from "./native";
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

export const frontierSeasonOnePreset = {
  ...frontierPreset,
  id: FRONTIER_S1_PRESET_ID,
  modeRules: (frontierPreset.modeRules | rules.DISCOVER_SPIRES) & ~(rules.DISCOVER_CHESTS | rules.SEASON_CLOSE),
  chests: null,
  race,
  commandMask:
    (frontierPreset.commandMask | BigInt(nativeCommandBits.ApplyRelic)) &
    ~(
      BigInt(nativeCommandBits.OpenRelicChest) |
      BigInt(nativeCommandBits.RefillStamina) |
      BigInt(nativeCommandBits.WithdrawLords)
    ),
  depths: frontierPreset.depths.map((depth, index) =>
    index === 1 ? { ...depth, chest: { common: 0, uncommon: 5_000, rare: 2_800, epic: 1_500, legendary: 700 } } : depth,
  ),
  research: [
    ...frontierPreset.research.filter(({ row }) => row !== research.ROW_DEPTH),
    { row: research.ROW_DEPTH, tier: 1, essenceCost: 10_000, laborCost: 0 },
  ],
  balance: {
    season: { durationSeconds: (race.seasonDays / DAYS_PER_BAG) * DAY_UNITS_PER_BAG * FRONTIER_DAY_UNIT_SECONDS },
    startingResources: [
      { resource: ResourcesIds.Knight, amount: 3_000 },
      { resource: ResourcesIds.Wheat, amount: 6_000 },
      { resource: ResourcesIds.Labor, amount: 2_000 },
    ],
  },
} satisfies NativePreset;
