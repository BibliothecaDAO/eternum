import { frontierPreset } from "./frontier/native";
import { blitzPreset } from "./blitz/native";
import { eternumPreset } from "./eternum/native";
import { duelPreset } from "./duel/native";
import type { NativePreset } from "./common/native-preset";
import type { GameType } from "./common/types";

const modes: Record<GameType, NativePreset> = {
  frontier: frontierPreset,
  blitz: blitzPreset,
  eternum: eternumPreset,
  duel: duelPreset,
};
export const nativePresets: Record<number, NativePreset> = Object.fromEntries(
  Object.values(modes).map((preset) => [preset.id, preset]),
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
