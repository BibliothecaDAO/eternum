import { orders } from "../../../packages/types/src/constants";
import { nativeCommandBits } from "../../../contracts/l3/world-native/schema/commands.gen";
import { nativeRuleConstants as rules } from "../../../contracts/l3/world-native/schema/client.gen";
import type { NativePreset } from "../common/native-preset";
import { FRONTIER_S1_PRESET_ID } from "../common/native-preset-modes";
import { frontierPreset } from "./native";

export const frontierSeasonOnePreset = {
  ...frontierPreset,
  id: FRONTIER_S1_PRESET_ID,
  orderAspects: orders.filter(({ aspect }) => aspect !== null).map(({ aspect }) => aspect!),
  modeRules: frontierPreset.modeRules & ~rules.DISCOVER_CHESTS,
  chests: null,
  commandMask:
    (frontierPreset.commandMask | BigInt(nativeCommandBits.ApplyRelic)) & ~BigInt(nativeCommandBits.OpenRelicChest),
} satisfies NativePreset;
