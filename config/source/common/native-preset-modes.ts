import type { GameType } from "./types";

/** The fixture preset for accelerated Frontier: fixtures and harness design runs create from it, the launcher never does. */
export const FRONTIER_ACCELERATED_PRESET_ID = 101;

/** Every registered preset id and the mode it plays: the one table Herald, the client and the tooling read. */
const NATIVE_PRESET_MODES: Readonly<Record<number, GameType>> = {
  1: "frontier",
  2: "blitz",
  3: "eternum",
  4: "duel",
  [FRONTIER_ACCELERATED_PRESET_ID]: "frontier",
};

export function nativeGameModeOf(presetId: number): GameType {
  const mode = NATIVE_PRESET_MODES[presetId];
  if (!mode) throw new Error(`Unknown native preset ${presetId}`);
  return mode;
}
