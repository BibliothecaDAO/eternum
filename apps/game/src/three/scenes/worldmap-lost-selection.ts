import { useUIStore } from "@/hooks/store/use-ui-store";
import { configManager } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";

import { getLiveWorldmapEntityActions } from "./worldmap-interaction-state";

/**
 * A selected army that is gone (lost in a fight) lets go of the map at once: its highlights are orders nobody can give.
 * Read from the facts themselves, since the armies' list is only as fresh as its last change. The map says why it let
 * go (letGoOfLostArmy), so the attack that cost the army still shows its loss: this is no player's newer choice.
 * Returns whether it let go; the map then clears what it drew for the selection.
 */
export const letGoOfLostSelection = (store: Pick<NativeFactStore, "get">): boolean => {
  const { selectedEntityId } = getLiveWorldmapEntityActions();
  if (selectedEntityId === null || selectedEntityId === undefined) return false;
  const gameId = configManager.getActiveGameId();
  const stands =
    store.get("ExplorerTroops", { game_id: gameId, explorer_id: selectedEntityId }) != null ||
    store.get("Structure", { game_id: gameId, entity_id: selectedEntityId }) != null;
  if (stands) return false;
  useUIStore.getState().letGoOfLostArmy();
  return true;
};
