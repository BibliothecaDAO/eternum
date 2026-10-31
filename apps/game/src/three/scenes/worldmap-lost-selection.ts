import { useUIStore } from "@/hooks/store/use-ui-store";
import { configManager } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";

import { getLiveWorldmapEntityActions } from "./worldmap-interaction-state";

/**
 * A selected army that is gone (lost in a fight) lets go of the map at once: its highlights are orders nobody can give.
 * Read from the facts themselves, since the armies' list is only as fresh as its last change. `clear` is the map's own
 * clearing of the selection (worldmap's clearEntitySelection, which deselects). Returns whether it let go.
 */
export const letGoOfLostSelection = (store: Pick<NativeFactStore, "get">, clear: () => void): boolean => {
  const { selectedEntityId } = getLiveWorldmapEntityActions();
  if (selectedEntityId === null || selectedEntityId === undefined) return false;
  const gameId = configManager.getActiveGameId();
  const stands =
    store.get("ExplorerTroops", { game_id: gameId, explorer_id: selectedEntityId }) != null ||
    store.get("Structure", { game_id: gameId, entity_id: selectedEntityId }) != null;
  if (stands) return false;
  letGoForTheMap(clear);
  return true;
};

/**
 * A site cleared under its open card (its payout's story, worldmap's onSitePayout) takes the card with it: the selected
 * tile is closed, an army acting on it staying selected. `coord` is the site's tile, in contract coordinates. Returns
 * whether it let go.
 */
export const letGoOfClearedSite = (coord: { x: number; y: number }): boolean => {
  const { selectedHex, closeSelectedTile } = useUIStore.getState();
  if (selectedHex?.col !== coord.x || selectedHex.row !== coord.y) return false;
  letGoForTheMap(closeSelectedTile);
  return true;
};

/**
 * The map's own cleanup of the selection, recorded with the pick it let go of (markLetGoByTheMap): no player chose
 * anything, so an order given from that pick still tells its outcome (useOrderSettledReturnsToTheArmy).
 */
const letGoForTheMap = (clear: () => void) => {
  const pick = useUIStore.getState().mapSelection;
  clear();
  useUIStore.getState().markLetGoByTheMap(pick);
};
