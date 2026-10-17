/**
 * The map's transfer gesture, as army orders read: another of your holdings right-clicked opens the transfer from the
 * selected holding, the one the HUD lights, however it was chosen (on the map or in the holdings list). With an army
 * selected the right-click is that army's order. Anything else (the selected holding itself, a holding that cannot
 * send or take goods, a mode without transfers) leaves the right-click to the map.
 */
export const transferGesture = ({
  selectedHoldingId,
  armySelected,
  clickedId,
  canTransferBetween,
  transfersAllowed,
}: {
  /** The holding the HUD lights (none is a number no holding has). */
  selectedHoldingId: number;
  armySelected: boolean;
  clickedId: number;
  /** Whether both holdings are yours and hold an inventory. */
  canTransferBetween: (sourceId: number, destinationId: number) => boolean;
  transfersAllowed: boolean;
}): { sourceId: number; destinationIds: number[] } | null => {
  if (!transfersAllowed || armySelected) return null;
  if (selectedHoldingId === clickedId || !canTransferBetween(selectedHoldingId, clickedId)) return null;
  return { sourceId: selectedHoldingId, destinationIds: [clickedId] };
};
