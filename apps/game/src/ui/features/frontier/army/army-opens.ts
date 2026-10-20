import { useSelectArmyOnMap } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { useEffect, useRef } from "react";

import { useDockArmies } from "../hud/dock-armies";

/**
 * How the army's panel opens (owner, 20 October: the bottom bar goes and the army's details open on selecting it, as
 * Blitz opens a selection's detail). The map's selection changing to one of the realm's armies opens it, for the player
 * acting in their own realm: never for a spectator (canIssueOrders reads the spectate intent), never on a visit (no
 * realm), and never for the same selection seen again (an order's update, a visit left), so a panel the player closed
 * stays closed. Returns the pick of an army (its row, its token, Today, Next up): another army is selected and that
 * change opens the panel, once; the army already selected reopens it.
 */
export const useArmyPanelOpens = (
  realm: NativeRows["Structure"] | null,
  openPanel: () => void,
): ((explorerId: number) => void) => {
  const armies = useDockArmies(realm);
  const acting = useUIStore(canIssueOrders);
  const selectedId = useUIStore((state) => state.entityActions.selectedEntityId);
  const selectArmy = useSelectArmyOnMap();
  const seen = useRef(selectedId);
  useEffect(() => {
    if (selectedId === seen.current) return;
    seen.current = selectedId;
    if (acting && armies.some(({ explorerId }) => explorerId === selectedId)) openPanel();
  });
  return (explorerId) => {
    const reopen = useUIStore.getState().entityActions.selectedEntityId === explorerId;
    selectArmy(explorerId);
    if (reopen) openPanel();
    // The selection now, while the map takes its request; its change opens the panel.
    else useUIStore.getState().selectOnMap({ kind: "army", entityId: explorerId, tile: null });
  };
};
