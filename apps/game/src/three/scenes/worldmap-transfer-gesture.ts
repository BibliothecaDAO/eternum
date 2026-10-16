import type { MapSelectionIntent } from "@/hooks/store/map-selection";

/**
 * The map's transfer gesture, as army orders read: one of your holdings selected, another of yours right-clicked,
 * opens the transfer from the first to the second. Anything else (no holding selected, the same one, a holding that
 * cannot send or take goods, a mode without transfers) leaves the right-click to the holding's own menu.
 */
export const transferGesture = ({
  selection,
  clickedId,
  canTransferBetween,
  transfersAllowed,
}: {
  selection: MapSelectionIntent;
  clickedId: number;
  /** Whether both holdings are yours and hold an inventory. */
  canTransferBetween: (sourceId: number, destinationId: number) => boolean;
  transfersAllowed: boolean;
}): { sourceId: number; destinationIds: number[] } | null => {
  if (!transfersAllowed || selection?.kind !== "structure") return null;
  const sourceId = Number(selection.entityId);
  if (sourceId === clickedId || !canTransferBetween(sourceId, clickedId)) return null;
  return { sourceId, destinationIds: [clickedId] };
};
