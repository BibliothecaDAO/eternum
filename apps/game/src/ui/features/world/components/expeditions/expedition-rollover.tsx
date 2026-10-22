import { useAccountStore } from "@/hooks/store/use-account-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { mistRolls, useDayEndStore } from "@/hooks/store/use-day-end-store";
import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import {
  configManager,
  seasonDay,
  getBlockTimestamp,
  entityHomeNamespace,
  expeditionRealmSite,
  isExpeditionRealm,
  Position,
  readExpeditionRules,
} from "@bibliothecadao/eternum";
import { getActiveGameSyncRuntime } from "@bibliothecadao/eternum/game-sync";
import { useGame } from "@/hooks/context/game-context";
import { useEffect, useRef } from "react";

/**
 * The one place a Frontier day turns over: the realm moves to its new region, the map is re-projected, and the camera
 * goes to it. For a player with a realm the turn is a moment (use-day-end-store): the mist rolls over the land that is
 * ending, and the new land comes in behind the black the screen drops into, so the cut never shows. Herald's scope
 * delivers the new day's rows; this only reacts to the clock.
 *
 * Two clocks are read on purpose: the turn runs on chain time, which leads the last block, but the map is re-projected
 * when the block clock turns, since a realm's site (structureMapPosition) is read from the block clock. Re-projecting
 * on chain time placed every realm on the day that was ending and left it there all day. So the black holds until the
 * block clock has turned too.
 */
export const ExpeditionRollover = () => {
  const { setup } = useGame();
  const address = useAccountStore((state) => state.account?.address ?? null);
  const navigateToMapView = useNavigateToMapView();
  const seasonDayRef = useRef<number | null | undefined>(undefined);
  const projectedDayRef = useRef<number | null | undefined>(undefined);
  /** The new day's site, kept for the black. */
  const newSite = useRef<Position | null>(null);
  /** The block clock turned while the mist rolled: the map is re-projected behind the black. */
  const reprojectBehindTheBlack = useRef(false);

  useEffect(() => {
    const gameId = configManager.getActiveGameId();
    const reproject = () => getActiveGameSyncRuntime()?.getWorldSpatialProjection()?.rebuild();

    /** Behind the black: the map re-projected once both clocks agree, the camera on the realm, then the black may lift. */
    const bringInTheNewLand = () => {
      const moment = useDayEndStore.getState();
      if (moment.phase !== "black" || moment.landReady) return;
      if (projectedDayRef.current !== seasonDayRef.current) return;
      if (reprojectBehindTheBlack.current) {
        reprojectBehindTheBlack.current = false;
        reproject();
      }
      if (newSite.current) navigateToMapView(newSite.current);
      newSite.current = null;
      moment.markLandReady();
    };

    const check = () => {
      const rules = readExpeditionRules(setup.store, gameId);
      if (!rules) return;
      const now = useChainTimeStore.getState().getNowSeconds();
      const projectedDay = seasonDay(rules, getBlockTimestamp().currentBlockTimestamp);
      if (projectedDayRef.current !== undefined && projectedDay !== projectedDayRef.current) {
        if (mistRolls(useDayEndStore.getState())) reprojectBehindTheBlack.current = true;
        else reproject();
      }
      projectedDayRef.current = projectedDay;
      const day = seasonDay(rules, now);
      if (seasonDayRef.current === undefined) {
        seasonDayRef.current = day;
        return;
      }
      if (day !== seasonDayRef.current) {
        seasonDayRef.current = day;
        if (day !== null) turnTheDay(rules, now);
      }
      bringInTheNewLand();
    };

    const turnTheDay = (rules: NonNullable<ReturnType<typeof readExpeditionRules>>, now: number) => {
      const realm = address
        ? [...setup.store.structuresOwnedBy(gameId, BigInt(address))].find((structure) =>
            isExpeditionRealm(setup.store, structure),
          )
        : undefined;
      if (!realm) return;
      // The turn fires on chain time, which runs ahead of the last block's timestamp, so the announced site is
      // computed for the day that is beginning rather than read through structureMapPosition's block clock.
      const site = expeditionRealmSite(rules, entityHomeNamespace(realm.entity_id), now);
      if (!site) return;
      const position = Position.fromContract({ x: site.col, y: site.row });
      useDayEndStore.getState().begin("live");
      // A moment already showing (a later arrival's summary) has no black to hide the cut behind: the camera goes now.
      if (useDayEndStore.getState().phase === "veil") newSite.current = position;
      else navigateToMapView(position);
    };

    check();
    const id = window.setInterval(check, 1_000);
    const unsubscribe = useDayEndStore.subscribe((moment, before) => {
      if (moment.phase !== before.phase) bringInTheNewLand();
    });
    return () => {
      window.clearInterval(id);
      unsubscribe();
    };
  }, [address, navigateToMapView, setup.store]);

  return null;
};
