import type { GameType } from "./types";

/** The fixture preset for accelerated Frontier: fixtures and harness design runs create from it, the launcher never does. */
export const FRONTIER_ACCELERATED_PRESET_ID = 101;
/** Frontier's own preset: the design the launcher's seasons create from. */
export const FRONTIER_PRESET_ID = 5;
/** Frontier's three-times-speed Devcon season; registered separately from normal-speed seasons. */
export const FRONTIER_DEVCON_PRESET_ID = 6;
/** Immutable Frontier preset used by the committed contract fixtures. */
export const FRONTIER_FIXTURE_PRESET_ID = 104;
/**
 * Frontier's playground, for dev only: Frontier's rules with a realm that starts rich and upgrades for next to nothing,
 * so a fully upgraded realm and every depth can be played within minutes. Registered on a dev shard by hand; the
 * launcher never creates from it.
 */
export const FRONTIER_PLAYGROUND_PRESET_ID = 105;

/** Every registered preset id and the mode it plays: the one table Herald, the client and the tooling read. */
const NATIVE_PRESET_MODES: Readonly<Record<number, GameType>> = {
  // Frontier's first design; registered on the shards and still played by the games created from it.
  1: "frontier",
  2: "blitz",
  3: "eternum",
  4: "duel",
  [FRONTIER_PRESET_ID]: "frontier",
  [FRONTIER_DEVCON_PRESET_ID]: "frontier",
  [FRONTIER_ACCELERATED_PRESET_ID]: "frontier",
  // The first playtest's preset; registered on shard A and still played by the game created from it.
  102: "frontier",
  103: "eternum",
  [FRONTIER_FIXTURE_PRESET_ID]: "frontier",
  [FRONTIER_PLAYGROUND_PRESET_ID]: "frontier",
};

export function nativeGameModeOf(presetId: number): GameType {
  const mode = NATIVE_PRESET_MODES[presetId];
  if (!mode) throw new Error(`Unknown native preset ${presetId}`);
  return mode;
}
