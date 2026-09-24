import type { GameType } from "./types";

/** The fixture preset for accelerated Frontier: fixtures and harness design runs create from it, the launcher never does. */
export const FRONTIER_ACCELERATED_PRESET_ID = 101;
/** The fixture preset for the owner's playtests: Frontier's design with one-hour days; the launcher never creates from it. */
export const FRONTIER_PLAYTEST_PRESET_ID = 102;
/** Frontier's own preset: the design the launcher's seasons create from. */
export const FRONTIER_PRESET_ID = 5;

/** Every registered preset id and the mode it plays: the one table Herald, the client and the tooling read. */
const NATIVE_PRESET_MODES: Readonly<Record<number, GameType>> = {
  // Frontier's first design; registered on the shards and still played by the games created from it.
  1: "frontier",
  2: "blitz",
  3: "eternum",
  4: "duel",
  [FRONTIER_PRESET_ID]: "frontier",
  [FRONTIER_ACCELERATED_PRESET_ID]: "frontier",
  [FRONTIER_PLAYTEST_PRESET_ID]: "frontier",
};

export function nativeGameModeOf(presetId: number): GameType {
  const mode = NATIVE_PRESET_MODES[presetId];
  if (!mode) throw new Error(`Unknown native preset ${presetId}`);
  return mode;
}
