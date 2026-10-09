import { frontierPreset } from "./frontier/native";
import { blitzPreset } from "./blitz/native";
import { eternumPreset } from "./eternum/native";
import { duelPreset } from "./duel/native";
import type { NativePreset } from "./common/native-preset";
import { FRONTIER_ACCELERATED_PRESET_ID, SELF_CHECK_PRESET_ID, nativeGameModeOf } from "./common/native-preset-modes";
import { nativeCommandBits } from "../../contracts/l3/world-native/schema/commands.gen";
import type { GameType } from "./common/types";

const modes: Record<GameType, NativePreset> = {
  frontier: frontierPreset,
  blitz: blitzPreset,
  eternum: eternumPreset,
  duel: duelPreset,
};
/**
 * Frontier 120 times faster, for automated tests only: a 1 s armies tick and a 120 s day unit, so its drawn days last 4
 * to 12 minutes, a bag 40 minutes and its season of 21 bags 14 hours. Presets are immutable, so it has its own id.
 */
const frontierAcceleratedPreset: NativePreset = {
  ...frontierPreset,
  id: FRONTIER_ACCELERATED_PRESET_ID,
  clockScale: 120,
};

// This immutable fixture changes route availability only. Real mode/domain refusals remain part of its check.
const selfCheckPreset: NativePreset = {
  ...eternumPreset,
  id: SELF_CHECK_PRESET_ID,
  commandMask: Object.values(nativeCommandBits).reduce((mask, bit) => mask | BigInt(bit), 0n),
};

export const nativePresets: Record<number, NativePreset> = Object.fromEntries(
  [...Object.values(modes), frontierAcceleratedPreset, selfCheckPreset].map((preset) => {
    if (nativeGameModeOf(preset.id) !== preset.gameType)
      throw new Error(`Native preset ${preset.id} plays ${preset.gameType}, not ${nativeGameModeOf(preset.id)}`);
    return [preset.id, preset];
  }),
);

export function nativePresetForId(id: number): NativePreset {
  const preset = nativePresets[id];
  if (!preset) throw new Error(`Unsupported native preset ${id}`);
  return preset;
}
export function nativePresetIdFor(gameType: GameType): number {
  const preset = modes[gameType];
  if (!preset) throw new Error("No native preset for " + gameType);
  return preset.id;
}
