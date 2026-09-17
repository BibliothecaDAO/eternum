import type { Tile } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { configManager } from "../managers/config-manager";
import { tileOptToTile } from "./tile-opt";

export { tileOptToTile } from "./tile-opt";
export const DEFAULT_COORD_ALT = false;

export function getTileAt(
  store: NativeFactStore,
  alt: boolean,
  col: number,
  row: number,
  gameId = configManager.getActiveGameId(),
): Tile | undefined {
  const rowValue = store.get("TileOpt", { game_id: gameId, alt, col, row });
  return rowValue ? tileOptToTile(rowValue) : undefined;
}
