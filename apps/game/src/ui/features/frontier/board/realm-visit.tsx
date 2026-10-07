import { useGame } from "@/hooks/context/game-context";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { usePlayerDisplayName } from "@/hooks/use-player-profile";
import { leaveRealmVisit, type RealmVisit, useRealmVisit } from "@/sync/active-game-client";
import { PlayerName } from "@/ui/design-system/kit/player-name";
import { configManager, Position, structureMapPosition } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useEffect, useRef } from "react";

import { VisitFoot } from "./visit-foot";

/** The visited realm's row, once the visit's scope has brought it into the store. */
export const useVisitedRealm = (visit: RealmVisit | null): NativeRows["Structure"] | null => {
  const { setup } = useGame();
  useNativeRevision(["Structure"]);
  if (!visit) return null;
  return (
    setup.store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: visit.structureId }) ?? null
  );
};

/**
 * While visiting another realm, the foot that names it, with Leave. The realm opens once its rows arrive with the
 * visit's scope, as a realm the player does not own, so every order stays off. Leaving returns to the player's own
 * realm. Stays mounted between visits, so the way home runs after one ends.
 */
export const RealmVisitFoot = ({ home }: { home: NativeRows["Structure"] | null }) => {
  const { setup } = useGame();
  const visit = useRealmVisit();
  const previousVisit = useRef(visit);
  const visited = useVisitedRealm(visit);
  const name = usePlayerDisplayName(visit?.player) ?? "—";
  const goToStructure = useGoToStructure(setup);
  const openRealm = (realm: NativeRows["Structure"], spectator: boolean) => {
    const site = structureMapPosition(setup.store, realm);
    if (site) void goToStructure(realm.entity_id, Position.fromContract(site), false, { spectator });
  };

  useEffect(() => {
    if (visited) openRealm(visited, true);
    // Once per arrival: the realm opens when its row first reaches the store.
  }, [visited?.entity_id]);

  useEffect(() => {
    if (visit) {
      previousVisit.current = visit;
      return;
    }
    if (!previousVisit.current) return;
    if (!useUIStore.getState().isSpectating) {
      previousVisit.current = null;
      return;
    }
    if (home) {
      previousVisit.current = null;
      openRealm(home, false);
    }
  }, [visit, home]);

  if (!visit) return null;

  return (
    <VisitFoot
      label={name}
      order={visited && visited.metadata.order > 0 ? visited.metadata.order : undefined}
      name={<PlayerName account={visit.player} />}
      arriving={!visited}
      onLeave={home ? leaveRealmVisit : undefined}
    />
  );
};
