import { useAccountStore } from "@/hooks/store/use-account-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { toast } from "@/ui/features/event-feed/notify";
import {
  configManager,
  seasonDay,
  getBlockTimestamp,
  expeditionRealmSite,
  isExpeditionRealm,
  Position,
  readExpeditionRules,
} from "@bibliothecadao/eternum";
import { getActiveGameSyncRuntime } from "@bibliothecadao/eternum/game-sync";
import { useGame } from "@/hooks/context/game-context";
import { troopsOnHand } from "@/ui/features/frontier/frontier-home";
import { useEffect, useRef } from "react";

/**
 * The one place a Frontier day turns over: the realm moves to its new region, the map is re-projected, and the
 * player is told. Herald's scope delivers the new day's rows; this only reacts to the clock. Two clocks are read on
 * purpose: the announcement runs on chain time, which leads the last block, but the map is re-projected when the
 * block clock turns, since a realm's site (structureMapPosition) is read from the block clock. Re-projecting on chain
 * time placed every realm on the day that was ending and left it there all day.
 */
export const ExpeditionRollover = () => {
  const { setup } = useGame();
  const address = useAccountStore((state) => state.account?.address ?? null);
  const navigateToMapView = useNavigateToMapView();
  const seasonDayRef = useRef<number | null>(null);
  const projectedDayRef = useRef<number | null>(null);

  useEffect(() => {
    const gameId = configManager.getActiveGameId();
    const check = () => {
      const rules = readExpeditionRules(setup.store, gameId);
      if (!rules) return;
      const now = useChainTimeStore.getState().getNowSeconds();
      const projectedDay = seasonDay(rules, getBlockTimestamp().currentBlockTimestamp);
      if (projectedDayRef.current !== null && projectedDay !== projectedDayRef.current)
        getActiveGameSyncRuntime()?.getWorldSpatialProjection()?.rebuild();
      projectedDayRef.current = projectedDay;
      const day = seasonDay(rules, now);
      if (seasonDayRef.current === null) {
        seasonDayRef.current = day;
        return;
      }
      if (day === seasonDayRef.current) return;
      seasonDayRef.current = day;
      const realm = address
        ? [...setup.store.structuresOwnedBy(gameId, BigInt(address))].find((structure) =>
            isExpeditionRealm(setup.store, structure),
          )
        : undefined;
      if (!realm) return;
      // The rollover fires on chain time, which runs ahead of the last block's timestamp, so the announced site is
      // computed for the day that is beginning rather than read through structureMapPosition's block clock.
      const site = expeditionRealmSite(rules, realm.metadata.realm_id, now);
      toast.info("A new expedition has begun", {
        description: describeNewExpedition(
          troopsOnHand(setup.store, realm.entity_id, getBlockTimestamp().currentDefaultTick),
        ),
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

/**
 * Opens the day's muster only when there is something to muster; otherwise it says where troops come from. With the
 * troops at home unknown it claims neither.
 */
export const describeNewExpedition = (troops: number | undefined): string => {
  if (troops === undefined) return "Fresh fog around your realm. Yesterday's armies are spent.";
  return troops >= 1
    ? "Fresh fog around your realm. Yesterday's armies are spent; today's muster is open."
    : "Fresh fog around your realm. Yesterday's armies are spent and no troops are on hand: a barracks on the realm board trains them.";
};
