import { blitzPreset } from "./native";
import { arenaBaseConfig } from "../common/arena/base";
import { mergeConfigPatches, type ConfigPatch } from "../common/merge-config";
import { blitzBalance } from "./balance";

export const blitzBaseConfig: ConfigPatch = mergeConfigPatches(arenaBaseConfig, blitzBalance, {
  presetId: blitzPreset.id,
});
