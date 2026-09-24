import { useAccountStore } from "@/hooks/store/use-account-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { toast } from "@/ui/features/event-feed/notify";
import {
  configManager,
  divideByPrecision,
  expeditionEpoch,
  getBalance,
  getBlockTimestamp,
  getTroopResourceId,
  expeditionRealmSite,
  isExpeditionRealm,
  Position,
  readExpeditionRules,
} from "@bibliothecadao/eternum";
import { getActiveGameSyncRuntime } from "@bibliothecadao/eternum/game-sync";
import { TroopTier, TroopType, type ID } from "@bibliothecadao/types";
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
      // The rollover fires on chain time, which runs ahead of the last block's timestamp, so the announced site is
      // computed for the day that is beginning rather than read through structureMapPosition's block clock.
      const site = expeditionRealmSite(rules, realm.metadata.realm_id, now);
      toast.info("A new expedition has begun", {
        description: describeNewExpedition(readTroopsOnHand(setup.store, realm.entity_id)),
        location: { x: site.col, y: site.row },
      });
      navigateToMapView(Position.fromContract({ x: site.col, y: site.row }));
    };
    check();
    const id = window.setInterval(check, 1_000);
    return () => window.clearInterval(id);
  }, [address, navigateToMapView, setup.store]);

  return null;
};

const TROOP_RESOURCE_IDS = [TroopType.Knight, TroopType.Crossbowman, TroopType.Paladin].flatMap((type) =>
  [TroopTier.T1, TroopTier.T2, TroopTier.T3].map((tier) => getTroopResourceId(type, tier)),
);

const readTroopsOnHand = (store: ReturnType<typeof useGame>["setup"]["store"], realmId: ID): number => {
  const { currentDefaultTick } = getBlockTimestamp();
  // The player's own realm always has its resources in scope.
  return TROOP_RESOURCE_IDS.reduce(
    (total, resourceId) =>
      total + divideByPrecision(getBalance(realmId, resourceId, currentDefaultTick, store).balance!),
    0,
  );
};

/** Opens the day's muster only when there is something to muster; otherwise it says where troops come from. */
export const describeNewExpedition = (troopsOnHand: number): string =>
  troopsOnHand >= 1
    ? "Fresh fog around your realm. Yesterday's armies are spent; today's muster is open."
    : "Fresh fog around your realm. Yesterday's armies are spent and no troops are on hand: a barracks on the realm board trains them.";
