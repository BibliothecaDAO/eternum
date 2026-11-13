import {
  nativeResearchConstants as research,
  nativeRuleConstants as rules,
} from "../../../contracts/l3/world-native/schema/client.gen";
import { nativeCommandBits } from "../../../contracts/l3/world-native/schema/commands.gen";
import { DAYS_PER_BAG, DAY_UNITS_PER_BAG } from "../../../packages/core/src/utils/days";
import { ResourcesIds } from "../../../packages/types/src/constants";
import type { NativePreset } from "../common/native-preset";
import { FRONTIER_S1_PRESET_ID } from "../common/native-preset-modes";
import { FRONTIER_DAY_UNIT_SECONDS } from "./clock";
import { frontierPreset } from "./native";

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
    (frontierPreset.commandMask | BigInt(nativeCommandBits.ApplyRelic)) & ~BigInt(nativeCommandBits.OpenRelicChest),
  depths: frontierPreset.depths.map((depth, index) =>
    index < 3
      ? {
          ...depth,
          beastWeakLower: 300 * 2 ** index,
          beastWeakUpper: 400 * 2 ** index,
          beastStrongLower: 400 * 2 ** index,
          beastStrongUpper: 500 * 2 ** index,
          chest: index === 1 ? { common: 0, uncommon: 5_000, rare: 2_800, epic: 1_500, legendary: 700 } : depth.chest,
        }
      : depth,
  ),
  research: [
    ...frontierPreset.research.filter(({ row }) => row !== research.ROW_DEPTH),
    { row: research.ROW_DEPTH, tier: 1, essenceCost: 10_000, laborCost: 0 },
  ],
  balance: {
    resources: {
      productionBySimpleRecipe: { [ResourcesIds.Paladin]: [{ resource: ResourcesIds.Wheat, amount: 2 }] },
      productionBySimpleRecipeOutputs: { [ResourcesIds.Paladin]: 1 },
      productionByComplexRecipeOutputs: { [ResourcesIds.Paladin]: 100 / 3600 },
    },
    buildings: {
      simpleBuildingCost: { [research.SCOUTS_LODGE]: [{ resource: ResourcesIds.Labor, amount: 500 }] },
    },
    season: { durationSeconds: (race.seasonDays / DAYS_PER_BAG) * DAY_UNITS_PER_BAG * FRONTIER_DAY_UNIT_SECONDS },
    startingResources: [
      { resource: ResourcesIds.Knight, amount: 3_000 },
      { resource: ResourcesIds.Wheat, amount: 6_000 },
      { resource: ResourcesIds.Labor, amount: 2_000 },
    ],
  },
} satisfies NativePreset;
