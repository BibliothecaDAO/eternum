import { ActionType } from "@bibliothecadao/eternum";

/** Reanchoring only opens another preview; a map click must never submit an order. */
export function isMapPreviewAction(button: number, action: ActionType | null | undefined): boolean {
  return button === 2 && (action === ActionType.Attack || action === ActionType.Help || action === ActionType.Chest || action === ActionType.SpireTravel);
}
