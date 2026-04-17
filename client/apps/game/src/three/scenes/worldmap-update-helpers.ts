import { ExplorerTroopsSystemUpdate } from "@bibliothecadao/eternum";
import { ID } from "@bibliothecadao/types";

type ExplorerTroopsUpdateHandlers = {
  cancelPendingArmyRemoval: (entityId: ID) => void;
  scheduleArmyRemoval: (entityId: ID, reason: "tile" | "zero") => void;
  updateArmyHexes: (update: ExplorerTroopsSystemUpdate) => void;
  updateArmyFromExplorerTroopsUpdate: (update: ExplorerTroopsSystemUpdate) => void;
};

export function processExplorerTroopsUpdate(
  update: ExplorerTroopsSystemUpdate,
  handlers: ExplorerTroopsUpdateHandlers,
): void {
  handlers.cancelPendingArmyRemoval(update.entityId);

  if (update.troopCount <= 0) {
    // Keep army manager state in sync so zero-count transitions can trigger death handling
    // before worldmap removal.
    handlers.updateArmyFromExplorerTroopsUpdate(update);
    handlers.scheduleArmyRemoval(update.entityId, "zero");
    return;
  }

  handlers.updateArmyHexes(update);
  handlers.updateArmyFromExplorerTroopsUpdate(update);
}
