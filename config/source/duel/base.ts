import { duelPreset } from "./native";
import { arenaBaseConfig } from "../common/arena/base";
import { mergeConfigPatches, type ConfigPatch } from "../common/merge-config";
import { duelBalance } from "./balance";

export const duelBaseConfig: ConfigPatch = mergeConfigPatches(arenaBaseConfig, duelBalance, {
  presetId: duelPreset.id,
});
