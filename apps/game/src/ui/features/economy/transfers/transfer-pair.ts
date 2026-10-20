import { readActivePlayerStructures } from "@/sync/fact-views";
import { resolveStructureUiCapabilities } from "@/ui/lib/structure-capabilities";

/** Whether goods can go from one holding to another: both are the player's and both hold an inventory. */
export const isTransferPair = (sourceId: number, destinationId: number): boolean => {
  const holdings = readActivePlayerStructures();
  const transfers = (id: number) =>
    holdings.some(
      (holding) =>
        Number(holding.entityId) === id && resolveStructureUiCapabilities(holding.structure).canOpenTransferInventory,
    );
  return transfers(sourceId) && transfers(destinationId);
};
