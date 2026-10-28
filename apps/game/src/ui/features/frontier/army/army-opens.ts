import { useSelectArmyOnMap } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { useEffect, useRef } from "react";

import { useDockArmies } from "../hud/dock-armies";
import { useSelectedArmySpire } from "../spire-card";

/**
 * How the army's panel opens (owner, 20 October: the bottom bar goes and the army's details open on selecting it, as
 * Blitz opens a selection's detail). Every opening asks the same thing at that moment: one of the realm's armies, for
 * the player acting in it (canIssueOrders, which reads spectator-session's intent: a signed-in owner who entered to
 * spectate never gets the panel), and none on a visit (no realm). The map's selection changing to such an army opens
 * it, never the same selection seen again (an order's update, a visit left), so a panel the player closed stays
 * closed. Returns the pick of an army (its row, its token, Today, Next up): another army is selected and that change
 * opens the panel, once; the army already selected reopens it. A phone's Level up opens its choices. An army selected
 * on or beside its realm's spire opens the spire's card instead (useSelectedArmySpire), where it enters a depth; picking
 * it again opens its panel. Also returns the
 * way back to an army a card acted for, once the card's job is done (a clear, owner 27 October 2026: "the panel on the
 * right should go back to my army panel since its still selected"): the selection goes back to the army's own tile, and
 * its panel opens where selecting an army opens it (a desktop's); a phone's action row shows the army again.
 */
export const useArmyPanelOpens = (
  realm: NativeRows["Structure"] | null,
  /** Opens the army's panel, on its level-up choices when `choosing`. */
  openPanel: (choosing: boolean) => void,
  /**
   * Whether selecting an army opens its panel: a desktop's. A phone keeps the map first (owner, 22 October 2026: mobile
   * direction A): a selection shows in the action row, and the panel opens from its details button or a pick here.
   */
  opensOnSelect: boolean,
): { pick: (explorerId: number, choosing?: boolean) => void; returnTo: (explorerId: number) => void } => {
  const armies = useDockArmies(realm);
  const selectedId = useUIStore((state) => state.entityActions.selectedEntityId);
  const selectArmy = useSelectArmyOnMap();
  const atItsSpire = useSelectedArmySpire() !== null;
  const seen = useRef(selectedId);
  const open = (explorerId: number | null, choosing = false) => {
    if (canIssueOrders() && armies.some((army) => army.explorerId === explorerId)) openPanel(choosing);
  };
  useEffect(() => {
    if (selectedId === seen.current) return;
    seen.current = selectedId;
    if (opensOnSelect && !atItsSpire) open(selectedId);
  });
  return {
    pick: (explorerId, choosing) => {
      const reopen = useUIStore.getState().entityActions.selectedEntityId === explorerId;
      pickArmy(selectArmy, explorerId);
      if (reopen || !opensOnSelect) open(explorerId, choosing);
    },
    returnTo: (explorerId) => {
      useUIStore.getState().selectOnMap({ kind: "army", entityId: explorerId, tile: "own" });
      if (opensOnSelect) open(explorerId);
    },
  };
};

/**
 * Picks one of the realm's armies from the HUD (a dock's token or row): the map frames and selects it, and the selection
 * holds now, while the map takes the request.
 */
export const usePickArmy = (): ((explorerId: number) => void) => {
  const selectArmy = useSelectArmyOnMap();
  return (explorerId) => pickArmy(selectArmy, explorerId);
};

const pickArmy = (selectArmy: (explorerId: number) => void, explorerId: number) => {
  selectArmy(explorerId);
  useUIStore.getState().selectOnMap({ kind: "army", entityId: explorerId, tile: null });
};
