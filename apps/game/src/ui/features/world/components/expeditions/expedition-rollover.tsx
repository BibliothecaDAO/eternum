import { useAccountStore } from "@/hooks/store/use-account-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { toast } from "@/ui/features/event-feed/notify";
import {
  configManager,
  expeditionEpoch,
  expeditionRealmSite,
  isExpeditionRealm,
  Position,
  readExpeditionRules,
} from "@bibliothecadao/eternum";
import { getActiveGameSyncRuntime } from "@bibliothecadao/eternum/game-sync";
import { useGame } from "@/hooks/context/game-context";
import { useEffect, useRef } from "react";

/**
 * The one place a Frontier day turns over: the realm moves to its new region, the map is re-projected, and the
 * player is told. Herald's scope delivers the new day's rows; this only reacts to the clock.
 */
export const ExpeditionRollover = () => {
  const { setup } = useGame();
  const address = useAccountStore((state) => state.account?.address ?? null);
  const navigateToMapView = useNavigateToMapView();
  const epochRef = useRef<number | null>(null);

  useEffect(() => {
    const gameId = configManager.getActiveGameId();
    const check = () => {
      const rules = readExpeditionRules(setup.store, gameId);
      if (!rules) return;
      const now = useChainTimeStore.getState().getNowSeconds();
      const epoch = expeditionEpoch(rules, now);
      if (epochRef.current === null) {
        epochRef.current = epoch;
        return;
      }
      if (epoch === epochRef.current) return;
      epochRef.current = epoch;
      getActiveGameSyncRuntime()?.getWorldSpatialProjection()?.rebuild();
      const realm = address
        ? [...setup.store.structuresOwnedBy(gameId, BigInt(address))].find(isExpeditionRealm)
        : undefined;
      if (!realm) return;
      const site = expeditionRealmSite(rules, realm, now);
      toast.info("A new expedition has begun", {
        description: "Fresh fog around your realm. Yesterday's armies are spent; today's muster is open.",
        location: { x: site.col, y: site.row },
      });
      navigateToMapView(new Position({ x: site.col, y: site.row }));
    };
    check();
    const id = window.setInterval(check, 1_000);
    return () => window.clearInterval(id);
  }, [address, navigateToMapView, setup.store]);

  return null;
};
