import { useSelectArmyOnMap } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { useEffect, useRef } from "react";

import { useDockArmies } from "../hud/dock-armies";

/**
 * How the army's panel opens (owner, 20 October: the bottom bar goes and the army's details open on selecting it, as
 * Blitz opens a selection's detail). Every opening asks the same thing at that moment: one of the realm's armies, for
 * the player acting in it (canIssueOrders, which reads spectator-session's intent: a signed-in owner who entered to
 * spectate never gets the panel), and none on a visit (no realm). The map's selection changing to such an army opens
 * it, never the same selection seen again (an order's update, a visit left), so a panel the player closed stays
 * closed. Returns the pick of an army (its row, its token, Today, Next up): another army is selected and that change
 * opens the panel, once; the army already selected reopens it.
 */
export const useArmyPanelOpens = (
  realm: NativeRows["Structure"] | null,
  openPanel: () => void,
): ((explorerId: number) => void) => {
  const armies = useDockArmies(realm);
  const selectedId = useUIStore((state) => state.entityActions.selectedEntityId);
  const selectArmy = useSelectArmyOnMap();
  const seen = useRef(selectedId);
  const open = (explorerId: number | null) => {
    if (canIssueOrders() && armies.some((army) => army.explorerId === explorerId)) openPanel();
  };
  useEffect(() => {
    if (selectedId === seen.current) return;
    seen.current = selectedId;
    open(selectedId);
  });
  return (explorerId) => {
    const reopen = useUIStore.getState().entityActions.selectedEntityId === explorerId;
    selectArmy(explorerId);
    if (reopen) open(explorerId);
    // The selection now, while the map takes its request; its change opens the panel.
    else useUIStore.getState().selectOnMap({ kind: "army", entityId: explorerId, tile: null });
  };
};
