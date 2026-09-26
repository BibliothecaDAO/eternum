import { useGame } from "@/hooks/context/game-context";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { usePlayerDisplayName } from "@/hooks/use-player-profile";
import { leaveRealmVisit, type RealmVisit, useRealmVisit } from "@/sync/active-game-client";
import { Eye } from "@/ui/design-system/atoms/game-icons";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { configManager, Position, structureMapPosition } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { useEffect } from "react";

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
 * While visiting another realm: an eye and whose it is, then Leave. The realm opens once its rows arrive with the
 * visit's scope, as a realm the player does not own, so every order stays off; the name pulses until then. Leaving
 * returns to the player's own realm.
 */
export const RealmVisitBanner = ({ home }: { home: NativeRows["Structure"] | null }) => {
  const { setup } = useGame();
  const visit = useRealmVisit();
  const visited = useVisitedRealm(visit);
  const name = usePlayerDisplayName(visit?.player) ?? "—";
  const goToStructure = useGoToStructure(setup);
  const openRealm = (realm: NativeRows["Structure"], spectator: boolean) =>
    void goToStructure(realm.entity_id, Position.fromContract(structureMapPosition(setup.store, realm)), false, {
      spectator,
    });

  useEffect(() => {
    if (visited) openRealm(visited, true);
    // Once per arrival: the realm opens when its row first reaches the store.
  }, [visited?.entity_id]);

  if (!visit) return null;
  const leave = () => {
    leaveRealmVisit();
    if (home) openRealm(home, false);
  };

  return (
    <div
      role="status"
      aria-label={`Visiting ${name}'s realm`}
      className="frontier-card pointer-events-auto flex items-center gap-3 self-center py-1.5 pl-3 pr-1.5 font-sans"
    >
      <Eye className="size-6" />
      <span
        className={cn(
          "max-w-[40vw] truncate font-[Lexend] text-[15px] font-extrabold text-[#eadfc8]",
          !visited && "animate-pulse",
        )}
      >
        {name}
      </span>
      {/* A spectator has no realm to return to; they switch whom they watch from the season board. */}
      {home && (
        <button type="button" onClick={leave} className="frontier-primary !h-10 !rounded-xl px-4 !text-base">
          Leave
        </button>
      )}
    </div>
  );
};
