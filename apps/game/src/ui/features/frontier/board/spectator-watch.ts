import { useAccountStore } from "@/hooks/store/use-account-store";
import { startRealmVisit, useRealmVisit } from "@/sync/active-game-client";
import { useEffect } from "react";

import { useSeasonBoard } from "./season-board";

/**
 * A spectator watches a realm, never an empty map: with no account to play, the stream visits the season board's
 * leader, whose realm, buildings and armies arrive read-only (the visit wire), and the season board switches whom
 * they watch. A signed-in player is never moved.
 */
export const useSpectatorWatchesTheLeader = (): void => {
  const spectator = useAccountStore((state) => !state.account?.address);
  const watching = useRealmVisit() !== null;
  const leader = useSeasonBoard().data?.[0];

  useEffect(() => {
    if (!spectator || watching || !leader) return;
    startRealmVisit({ player: leader.address, structureId: Number(leader.structure_id) });
  }, [leader, spectator, watching]);
};
