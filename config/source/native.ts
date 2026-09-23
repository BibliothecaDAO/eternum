import { frontierPreset } from "./frontier/native";
import { blitzPreset } from "./blitz/native";
import { eternumPreset } from "./eternum/native";
import { duelPreset } from "./duel/native";
import type { NativePreset } from "./common/native-preset";
import { FRONTIER_ACCELERATED_PRESET_ID, nativeGameModeOf } from "./common/native-preset-modes";
import type { GameType } from "./common/types";

const modes: Record<GameType, NativePreset> = {
  frontier: frontierPreset,
  blitz: blitzPreset,
  eternum: eternumPreset,
  duel: duelPreset,
};
/** Frontier with 720 s days, for fixtures and harness design runs; presets are immutable, so it has its own id. */
const frontierAcceleratedPreset: NativePreset = {
  ...frontierPreset,
  id: FRONTIER_ACCELERATED_PRESET_ID,
  clockScale: 120,
};

export const nativePresets: Record<number, NativePreset> = Object.fromEntries(
  [...Object.values(modes), frontierAcceleratedPreset].map((preset) => {
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
