/** A transfer's two ends, as the Transfer window opens on them. */
interface TransferEnds {
  sourceId: number;
  destinationIds: number[];
}

/** What a right-click is about: what the selected actor can do at the clicked tile, and what the tile holds. */
interface RightClickInput {
  /** The selected actor (an army or a holding) has an order at the clicked tile: a move, a help, a deploy tile. */
  orderAtTarget: boolean;
  /** An army is selected (on the map, or acting): a right-click on a holding never becomes a goods transfer. */
  armySelected: boolean;
  /** The holding the HUD lights, however it was chosen (none is a number no holding has). */
  selectedHoldingId: number;
  /** The clicked tile's structure, when it is one of the player's holdings. */
  clickedHoldingId: number | null;
  /** Whether goods can go between two holdings: both the player's, both with an inventory. */
  canTransferBetween: (sourceId: number, destinationId: number) => boolean;
  transfersAllowed: boolean;
}

/** Where a right-click can go. */
interface RightClickEffects {
  /** The selected actor's order handling: its order at the tile, or nothing to do there. */
  order: () => void;
  transfer: (ends: TransferEnds) => void;
  /** The clicked holding's own menu. */
  menu: () => void;
}

/**
 * Routes a right-click on the world map by what the selected actor can do at the clicked tile, never by whether it has
 * orders drawn somewhere else: its order there first (an army helping its realm, a holding's deploy tile). On another
 * of the player's holdings, the transfer from the selected holding to it; on one of the player's holdings otherwise
 * (the selected one among them, deploy tiles drawn or not), that holding's own menu. Anything else is the order
 * handling's.
 */
export const dispatchRightClick = (input: RightClickInput, effects: RightClickEffects): void => {
  if (input.orderAtTarget || input.clickedHoldingId === null) return effects.order();
  const ends = transferTo(input, input.clickedHoldingId);
  return ends ? effects.transfer(ends) : effects.menu();
};

/** The map's transfer gesture: from the selected holding to another that can take goods, with no army selected. */
const transferTo = (
  { armySelected, selectedHoldingId, canTransferBetween, transfersAllowed }: RightClickInput,
  clickedId: number,
): TransferEnds | null => {
  if (!transfersAllowed || armySelected) return null;
  if (selectedHoldingId === clickedId || !canTransferBetween(selectedHoldingId, clickedId)) return null;
  return { sourceId: selectedHoldingId, destinationIds: [clickedId] };
};
