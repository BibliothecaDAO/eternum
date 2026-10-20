import { settleEntryDestination } from "@/game-entry/entry-destination";
import { useAccountAddress } from "@/hooks/store/use-account-store";
import { resolvePlayRouteWorldPosition } from "@/play/navigation/play-route-target";
import { useRealmsPlayer } from "@/shell/herald";
import { startRealmVisit, useRealmVisit } from "@/sync/active-game-client";
import { isSameStarknetAddress } from "@realms-world/identity";
import { useEffect, useRef } from "react";

import { useSeasonBoard } from "./season-board";
import { safeInteger } from "@bibliothecadao/eternum/game-client";

/**
 * A spectator watches a realm, never an empty map: with no viewer (signed out, or entered to spectate with an account
 * still held, as the entry and every viewer read decide it), the stream visits the signed-in player's own realm when
 * they have one this season (a player watching the game they played), else the season board's leader. Its realm,
 * buildings and armies arrive read-only (the visit wire), and the season board switches whom they watch. The leader
 * this session chose yields to the player's own realm once the session names them; a realm the spectator chose stays.
 * The watched realm opens when it arrives, on the world map as every session opens, only if the address names no
 * place: a page loaded on a map hex (a shared link, the map re-opened at a far hex) stays where it was asked to be. A
 * season with no realm to watch, or a board that cannot be read, leaves nothing for the map to open on. A signed-in
 * player is never moved.
 */
export const useSpectatorWatch = (): void => {
  const spectator = useAccountAddress() === null;
  const visit = useRealmVisit();
  const board = useSeasonBoard();
  const { data: player } = useRealmsPlayer();
  const own = player ? board.data?.find((entry) => isSameStarknetAddress(entry.address, player)) : undefined;
  const watched = own ?? board.data?.[0];
  const nothing = board.isError || (board.data !== undefined && !watched);
  // The realm this session chose to watch; one the spectator chose is theirs to keep.
  const chosen = useRef<string | null>(null);

  useEffect(() => {
    if (!spectator) return;
    if (visit && visit.player !== chosen.current) return;
    if (nothing) settleEntryDestination(null);
    if (!watched || visit?.player === watched.address) return;
    chosen.current = watched.address;
    startRealmVisit({
      player: watched.address,
      structureId: safeInteger(watched.structure_id),
      // The address is read as it stands: the places move it without going through the router.
      opensOn: resolvePlayRouteWorldPosition(window.location) === null ? "map" : null,
    });
  }, [nothing, spectator, visit, watched]);
};
