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
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { getActiveGameSyncRuntime } from "@bibliothecadao/eternum/game-sync";
import { useGame } from "@/hooks/context/game-context";
import { useEffect, useRef } from "react";

/** The game's clocks, facts and map, as the day's turn reads and moves them. */
export interface DayTurnWorld {
  store: Pick<NativeFactStore, "get" | "require" | "structuresOwnedBy">;
  gameId: number;
  player: string | null;
  /** Chain time: the day turns on it. */
  chainNow(): number;
  /** The last block's time: the map's sites are read on it. */
  blockNow(): number;
  /** Re-projects the map on the block clock's day. */
  reproject(): void;
  /** Sends the camera to a position on the map. */
  navigate(position: Position): void;
}

const POLL_MS = 1_000;

/**
 * The one place a Frontier day turns over: the realm moves to its new region, the map is re-projected, and the camera
 * goes to it. For a player with a realm the turn is a moment (use-day-end-store): the mist rolls over the land that is
 * ending, and the new land comes in behind the black the screen drops into. Herald's scope delivers the new day's rows;
 * this only reacts to the clocks.
 *
 * Two clocks are read on purpose: the turn runs on chain time, which leads the last block, but the map is re-projected
 * when the block clock turns, since a realm's site (structureMapPosition) is read from the block clock. Re-projecting
 * on chain time placed every realm on the day that was ending and left it there all day.
 *
 * The camera comes onto the realm in the black, however the day ended: at the turn in the game, or for a game opened
 * after it, whose map may stand where the route left it the day before.
 *
 * The land's work and the moment's screen are kept apart. A re-projection or a camera move that is due stays due until
 * it is done, whatever the moment shows: it waits only while the mist rolls, so the land never changes in view. The
 * black waits for it, and when the black's longest hold lifts the screen first, the work still lands when the block
 * clock catches up.
 */
export function watchDayTurn(world: DayTurnWorld): () => void {
  let chainDay: number | null | undefined;
  let blockDay: number | null | undefined;
  let reprojectDue = false;
  let siteDue: Position | null = null;

  /** Brings the new land in once nothing would see it change: re-projected, then the camera on the realm's new site. */
  const bringInTheNewLand = () => {
    const moment = useDayEndStore.getState();
    if (mistRolls(moment)) return;
    if (reprojectDue) {
      reprojectDue = false;
      world.reproject();
    }
    // The site is on the chain clock's day; the camera goes once the map stands on that day too.
    if (siteDue && blockDay === chainDay) {
      world.navigate(siteDue);
      siteDue = null;
    }
    if (moment.phase === "black" && !reprojectDue && !siteDue) moment.markLandReady();
  };

  /** The player's realm's site on the chain clock's day; null for a viewer with no realm. */
  const realmSite = (): Position | null => {
    const rules = readExpeditionRules(world.store, world.gameId);
    const realm =
      rules && world.player
        ? [...world.store.structuresOwnedBy(world.gameId, BigInt(world.player))].find((structure) =>
            isExpeditionRealm(world.store, structure),
          )
        : undefined;
    // Chain time runs ahead of the last block's timestamp, so the site is computed for the day that is beginning
    // rather than read through structureMapPosition's block clock.
    const site = rules && realm && expeditionRealmSite(rules, entityHomeNamespace(realm.entity_id), world.chainNow());
    return site ? Position.fromContract({ x: site.col, y: site.row }) : null;
  };

  const check = () => {
    const rules = readExpeditionRules(world.store, world.gameId);
    if (!rules) return;
    const chain = seasonDay(rules, world.chainNow());
    const block = seasonDay(rules, world.blockNow());
    if (chainDay === undefined) {
      chainDay = chain;
      blockDay = block;
      return;
    }
    // The chain clock's turn is met first: both clocks turning between two looks still roll the mist before the
    // re-projection is let through.
    if (chain !== chainDay) {
      chainDay = chain;
      if (chain !== null && realmSite()) useDayEndStore.getState().begin("live");
    }
    if (block !== blockDay) {
      blockDay = block;
      reprojectDue = true;
    }
    bringInTheNewLand();
  };

  check();
  const id = setInterval(check, POLL_MS);
  const unsubscribe = useDayEndStore.subscribe((moment, before) => {
    if (moment.phase === before.phase) return;
    if (moment.phase === "black") siteDue = realmSite();
    bringInTheNewLand();
  });
  return () => {
    clearInterval(id);
    unsubscribe();
  };
}

/**
 * The day's turn on the game's own clocks, facts and map. One watcher lives as long as its game and player: the turn's
 * due work is the watcher's, so it is only dropped when they are left. The camera's navigation is reached through a
 * ref, as its function is new on every render and a map navigation renders this again.
 */
export const ExpeditionRollover = () => {
  const { setup } = useGame();
  const player = useAccountStore((state) => state.account?.address ?? null);
  const navigateToMapView = useNavigateToMapView();
  const navigate = useRef(navigateToMapView);
  useEffect(() => {
    navigate.current = navigateToMapView;
  }, [navigateToMapView]);

  useEffect(() => {
    return watchDayTurn({
      store: setup.store,
      gameId: configManager.getActiveGameId(),
      player,
      chainNow: () => useChainTimeStore.getState().getNowSeconds(),
      blockNow: () => getBlockTimestamp().currentBlockTimestamp,
      reproject: () => getActiveGameSyncRuntime()?.getWorldSpatialProjection()?.rebuild(),
      navigate: (position) => navigate.current(position),
    });
  }, [player, setup.store]);

  return null;
};
