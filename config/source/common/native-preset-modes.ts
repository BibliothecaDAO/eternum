import type { GameType } from "./types";

/** Historical accelerated Frontier; retired from new Season 1 games. */
export const FRONTIER_ACCELERATED_PRESET_ID = 101;
/** Historical Frontier; existing games keep their release and preset. */
export const FRONTIER_PRESET_ID = 5;
/** Historical three-times-speed Devcon season; retired from new Season 1 games. */
export const FRONTIER_DEVCON_PRESET_ID = 6;
/** Season 1's rules; registered separately from the earlier Frontier seasons. */
export const FRONTIER_S1_PRESET_ID = 7;
/** Slice 1 playtests cap upper-level bane quests at City until Scouts are available. */
export const FRONTIER_S1_DEV_PRESET_ID = 106;
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
  [FRONTIER_PRESET_ID]: "frontier",
  [FRONTIER_DEVCON_PRESET_ID]: "frontier",
  [FRONTIER_S1_PRESET_ID]: "frontier",
  [FRONTIER_S1_DEV_PRESET_ID]: "frontier",
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
