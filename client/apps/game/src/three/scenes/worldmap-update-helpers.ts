import { ExplorerTroopsSystemUpdate, Position } from "@bibliothecadao/eternum";
import { ID } from "@bibliothecadao/types";

type ExplorerTroopsUpdateHandlers = {
  cancelPendingArmyRemoval: (entityId: ID) => void;
  scheduleArmyRemoval: (entityId: ID, reason: "tile" | "zero") => void;
  updateArmyHexes: (update: ExplorerTroopsSystemUpdate) => void;
  moveArmyToAuthoritativeExplorerTroopsPosition: (update: ExplorerTroopsSystemUpdate) => Promise<void>;
  updateArmyFromExplorerTroopsUpdate: (update: ExplorerTroopsSystemUpdate) => void;
  onAuthoritativePositionApplied?: (update: ExplorerTroopsSystemUpdate) => void;
  shouldSkipStalePositionUpdate?: (entityId: ID, normalized: { x: number; y: number }) => boolean;
};

type ExplorerTroopsUpdateQueueHandlers = {
  processUpdate: (update: ExplorerTroopsSystemUpdate) => Promise<void>;
  onError?: (error: unknown, update: ExplorerTroopsSystemUpdate) => void;
};

export function enqueueExplorerTroopsUpdate(
  update: ExplorerTroopsSystemUpdate,
  queue: Map<ID, Promise<void>>,
  handlers: ExplorerTroopsUpdateQueueHandlers,
): void {
  const entityId = update.entityId;
  const previousUpdate = queue.get(entityId) ?? Promise.resolve();
  const queuedUpdate = previousUpdate
    .catch(() => undefined)
    .then(() => handlers.processUpdate(update))
    .catch((error) => {
      handlers.onError?.(error, update);
    });

  queue.set(entityId, queuedUpdate);

  void queuedUpdate.then(() => {
    if (queue.get(entityId) === queuedUpdate) {
      queue.delete(entityId);
    }
  });
}

export async function processExplorerTroopsUpdate(
  update: ExplorerTroopsSystemUpdate,
  handlers: ExplorerTroopsUpdateHandlers,
): Promise<void> {
  handlers.cancelPendingArmyRemoval(update.entityId);

  if (update.troopCount <= 0) {
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
    await handlers.moveArmyToAuthoritativeExplorerTroopsPosition(update);
  }
  // Always apply non-positional fields (stamina/troop-count/owner). Tick-based
  // staleness resolution downstream handles any regression in those fields.
  handlers.updateArmyFromExplorerTroopsUpdate(update);

  if (!shouldSkipPosition) {
    handlers.onAuthoritativePositionApplied?.(update);
  }
}
