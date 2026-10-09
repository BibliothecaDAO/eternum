import type { GameType } from "./types";

/** The fixture preset for accelerated Frontier: fixtures and harness design runs create from it, the launcher never does. */
export const FRONTIER_ACCELERATED_PRESET_ID = 101;
/** Frontier's own preset: the design the launcher's seasons create from. */
export const FRONTIER_PRESET_ID = 5;
/** Deployment's throwaway route check; it exposes every command to its actual domain guard. */
export const SELF_CHECK_PRESET_ID = 103;

/** Every registered preset id and the mode it plays: the one table Herald, the client and the tooling read. */
const NATIVE_PRESET_MODES: Readonly<Record<number, GameType>> = {
  // Frontier's first design; registered on the shards and still played by the games created from it.
  1: "frontier",
  2: "blitz",
  3: "eternum",
  4: "duel",
  [FRONTIER_PRESET_ID]: "frontier",
  [FRONTIER_ACCELERATED_PRESET_ID]: "frontier",
  // The first playtest's preset; registered on shard A and still played by the game created from it.
  102: "frontier",
  [SELF_CHECK_PRESET_ID]: "eternum",
};

export function nativeGameModeOf(presetId: number): GameType {
  const mode = NATIVE_PRESET_MODES[presetId];
  if (!mode) throw new Error(`Unknown native preset ${presetId}`);
  return mode;
}
