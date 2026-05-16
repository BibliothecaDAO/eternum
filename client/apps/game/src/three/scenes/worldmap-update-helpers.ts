import { ExplorerTroopsSystemUpdate, Position } from "@bibliothecadao/eternum";
import { ID } from "@bibliothecadao/types";

export type PendingArmyRemovalCancelSource =
  | "tile_recovery"
  | "delete"
  | "superseded"
  | "explorer_troops_zero"
  | "explorer_troops_live_recovery";

type ExplorerTroopsUpdateHandlers = {
  cancelPendingArmyRemoval: (entityId: ID, source: PendingArmyRemovalCancelSource) => void;
  scheduleArmyRemoval: (entityId: ID, reason: "tile" | "zero") => void;
  updateArmyHexes: (update: ExplorerTroopsSystemUpdate) => void;
  updateArmyFromExplorerTroopsUpdate: (update: ExplorerTroopsSystemUpdate) => void;
  recordLiveArmyPresenceUpdate?: (update: ExplorerTroopsSystemUpdate) => void;
  onAuthoritativePositionApplied?: (update: ExplorerTroopsSystemUpdate) => void;
  recoverPendingArmyRemovalFromExplorerTroops?: (update: ExplorerTroopsSystemUpdate) => void;
  shouldSkipStalePositionUpdate?: (entityId: ID, normalized: { x: number; y: number }) => boolean;
  shouldProcessLayerUpdate?: (update: ExplorerTroopsSystemUpdate) => boolean;
};

export function processExplorerTroopsUpdate(
  update: ExplorerTroopsSystemUpdate,
  handlers: ExplorerTroopsUpdateHandlers,
): void {
  if (handlers.shouldProcessLayerUpdate && !handlers.shouldProcessLayerUpdate(update)) {
    return;
  }

  if (update.troopCount <= 0) {
    handlers.cancelPendingArmyRemoval(update.entityId, "explorer_troops_zero");
    // Keep army manager state in sync so zero-count transitions can trigger death handling
    // before worldmap removal.
    handlers.updateArmyFromExplorerTroopsUpdate(update);
    handlers.scheduleArmyRemoval(update.entityId, "zero");
    return;
  }

  const normalized = new Position({ x: update.hexCoords.col, y: update.hexCoords.row }).getNormalized();
  const shouldSkipPosition = handlers.shouldSkipStalePositionUpdate?.(update.entityId, normalized) ?? false;

  if (!shouldSkipPosition) {
    handlers.updateArmyHexes(update);
  }

  // Always apply non-positional fields (stamina/troop-count/owner). Tick-based
  // staleness resolution downstream handles any regression in those fields.
  handlers.updateArmyFromExplorerTroopsUpdate(update);

  if (!shouldSkipPosition) {
    handlers.recordLiveArmyPresenceUpdate?.(update);
    handlers.onAuthoritativePositionApplied?.(update);
    handlers.recoverPendingArmyRemovalFromExplorerTroops?.(update);
  }
}
