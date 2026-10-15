import { settleEntryDestination } from "@/game-entry/entry-destination";
import { useAccountAddress } from "@/hooks/store/use-account-store";
import { resolvePlayRouteWorldPosition } from "@/play/navigation/play-route-target";
import { startRealmVisit, useRealmVisit } from "@/sync/active-game-client";
import { useEffect } from "react";

import { useSeasonBoard } from "./season-board";
import { safeInteger } from "@bibliothecadao/eternum/game-client";

/**
 * A spectator watches a realm, never an empty map: with no viewer (signed out, or entered to spectate with an account
 * still held, as the entry and every viewer read decide it), the stream visits the season board's
 * leader, whose realm, buildings and armies arrive read-only (the visit wire), and the season board switches whom
 * they watch. The watched realm opens when it arrives only if the address names no place: a page loaded on a map hex
 * (a shared link, the map re-opened at a far hex) stays where it was asked to be. A season with no leader to watch, or
 * a board that cannot be read, leaves nothing for the map to open on. A signed-in player is never moved.
 */
export const useSpectatorWatchesTheLeader = (): void => {
  const spectator = useAccountAddress() === null;
  const watching = useRealmVisit() !== null;
  const board = useSeasonBoard();
  const leader = board.data?.[0];
  const noLeader = board.isError || (board.data !== undefined && !leader);

  useEffect(() => {
    if (!spectator || watching) return;
    if (noLeader) settleEntryDestination(null);
    if (!leader) return;
    startRealmVisit({
      player: leader.address,
      structureId: safeInteger(leader.structure_id),
      // The address is read as it stands: the places move it without going through the router.
      opensOnArrival: resolvePlayRouteWorldPosition(window.location) === null,
    });
  }, [leader, noLeader, spectator, watching]);
};
