import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { dayOf, readExpeditionRules } from "@bibliothecadao/eternum/expeditions";
import { deepSites, RESOURCE_PRECISION, StructureType } from "@bibliothecadao/types";
import { currentArmy } from "@bibliothecadao/eternum/deep";
import { knowsSpireLore } from "@bibliothecadao/eternum/realm-research";
import { safeInteger } from "../../../packages/core/src/utils/safe-integer";
import { currentArmies } from "./army-rest";

/**
 * When one player can take one Deep site today; replaced whenever the player acts or the sites change, dropped once
 * it was alerted or can no longer come true today. `attempts` counts wakes that failed to read it.
 */
export interface SiteWatch {
  gameId: number;
  actor: string;
  owner: string;
  siteId: number;
  day: number;
  wakeAt: number;
  attempts: number;
}

/** One player in one game whose chances at the Deep's sites are worth watching. */
export interface SiteWatcher {
  gameId: number;
  actor: string;
  owner: string;
}

/** A site held by another Aspect that the player's largest army outside the Deep can take today, and when. */
export interface SiteChance {
  siteId: number;
  name: string;
  day: number;
  /** When the guard, all slots together, has drained to two thirds of the army: now, a later tick, or null today. */
  takeableAt: number | null;
  /** The guard's troops then, and the army's: what the alert says. */
  guard: number;
  army: number;
  /** When today ends, and the guards with it. */
  dayEndsAt: number;
}

export const siteWatchKey = (watch: { gameId: number; actor: string; siteId?: number }) =>
  `site:${watch.gameId}:${watch.actor}:${watch.siteId ?? ""}`;
export const siteWatcherKey = (watcher: { gameId: number; actor?: string }) =>
  `site-watcher:${watcher.gameId}:${watcher.actor ?? ""}`;
/** The one alert a player gets per site per game day. */
export const siteAlertedKey = (watch: { gameId: number; actor: string; siteId: number; day: number }) =>
  `site-alerted:${watch.gameId}:${watch.actor}:${watch.siteId}:${watch.day}`;

/** An army takes a guard it outnumbers by half again: 150% of the guard's troops (the design's one rule of a fight). */
const TAKES_AT_PERCENT = 150;

/**
 * The player's chances at each Deep site held by another Aspect today: when the guard's drain (the Deep lane's
 * projection, 200 troops a slot each army tick) brings it to where the player's largest army outside the Deep is 150%
 * of it. None for a player without a Realm that knows Spire lore, without an army outside the Deep, or in a game
 * without the Deep. A site whose guards' homes are of more than one Aspect, or of none, is a fault, never guessed.
 */
export const siteChances = (store: NativeFactStore, gameId: number, actor: string, now: number): SiteChance[] => {
  const calendar = readExpeditionRules(store, gameId);
  const today = calendar && dayOf(calendar, now / 1000);
  if (!hasTheDeep(store, gameId) || !today) return [];
  const realm = spireRealm(store, gameId, actor);
  const army = realm && largestArmyAbove(store, gameId, actor, now);
  if (!realm || !army) return [];
  const aspect = homeAspect(store, gameId, realm);
  const tickSeconds = Number(store.require("SliceRules", { game_id: gameId }).tick_config.armies_tick_in_seconds);
  return [...store.inGame("DeepSite", gameId)].flatMap((site) => {
    const guards = [...store.inGame("DeepGuard", gameId)]
      .filter((guard) => guard.site_id === site.entity_id)
      .map((guard) => store.require("ExplorerTroops", { game_id: gameId, explorer_id: guard.explorer_id }));
    if (site.day !== BigInt(today.index) || guards.length === 0) return [];
    if (holderOf(store, gameId, guards) === aspect) return [];
    const guardAt = (second: number) =>
      guards.reduce((total, guard) => total + currentArmy(store, guard, second).troops.count, 0n);
    const takeableAt = firstTickWhen(now / 1000, today.end, tickSeconds, (second) => outnumbers(army, guardAt(second)));
    return [
      {
        siteId: safeInteger(site.entity_id),
        name: siteName(site.kind),
        day: today.index,
        takeableAt: takeableAt === null ? null : Math.max(now, takeableAt * 1000),
        guard: troopsOf(guardAt(takeableAt ?? now / 1000)),
        army: troopsOf(army),
        dayEndsAt: today.end * 1000,
      },
    ];
  });
};

/** Whether the game has the Deep (its preset registered DeepRules): only such a game's players watch its sites. */
export const hasTheDeep = (store: NativeFactStore, gameId: number): boolean =>
  store.get("DeepRules", { game_id: gameId }) !== undefined;

/** A watch for each site the player can take today and was not yet told of; a site out of reach today has none. */
export const siteWatchesOf = (
  watcher: SiteWatcher,
  chances: SiteChance[],
  alerted: (watch: Omit<SiteWatch, "wakeAt" | "attempts">) => boolean,
): SiteWatch[] =>
  chances.flatMap((chance) => {
    const watch = { ...watcher, siteId: chance.siteId, day: chance.day };
    return chance.takeableAt === null || alerted(watch) ? [] : [{ ...watch, wakeAt: chance.takeableAt, attempts: 0 }];
  });

/** The player's Realm that knows Spire lore; the design gives the alert to such a Realm only. */
const spireRealm = (store: NativeFactStore, gameId: number, actor: string) =>
  [...store.structuresOwnedBy(gameId, BigInt(actor))].find(
    (structure) =>
      structure.base.category === StructureType.Realm && knowsSpireLore(store, gameId, structure.entity_id),
  );

/** The troops of the player's largest army of today outside the Deep; none without one. */
const largestArmyAbove = (store: NativeFactStore, gameId: number, actor: string, now: number): bigint | undefined =>
  currentArmies(store, gameId, actor, now)
    .filter((army) => !store.get("DeepArmy", { game_id: gameId, explorer_id: army.explorer_id }))
    .map((army) => army.troops.count)
    .reduce<bigint | undefined>(
      (largest, count) => (largest === undefined || count > largest ? count : largest),
      undefined,
    );

const homeAspect = (store: NativeFactStore, gameId: number, home: { entity_id: bigint }) => {
  const row = store.get("HomeAspect", { game_id: gameId, home: home.entity_id });
  if (!row) throw new Error(`Deep site watch: home ${home.entity_id} joined no Aspect`);
  return row.aspect;
};

/** The Aspect every guard's home joined: a site is one Aspect's (race-board.ts's holder, read the same way). */
const holderOf = (store: NativeFactStore, gameId: number, guards: readonly { owner: bigint }[]): number => {
  const holders = new Set(guards.map((guard) => homeAspect(store, gameId, { entity_id: guard.owner })));
  if (holders.size !== 1) throw new Error("Deep site watch: a site has guards of more than one Aspect");
  return [...holders][0]!;
};

const outnumbers = (army: bigint, guard: bigint) => army * 100n >= guard * BigInt(TAKES_AT_PERCENT);

/** The first second from `from`, then each army tick, before `end`, when the condition holds; null if none today. */
const firstTickWhen = (from: number, end: number, tickSeconds: number, holds: (second: number) => boolean) => {
  if (tickSeconds <= 0) throw new Error("Deep site watch: the army tick has no length");
  for (let second = from; second < end; second = (Math.floor(second / tickSeconds) + 1) * tickSeconds)
    if (holds(second)) return second;
  return null;
};

const troopsOf = (count: bigint) => Math.floor(Number(count) / RESOURCE_PRECISION);

const siteName = (kind: number) => {
  const site = deepSites.find((entry) => entry.id === kind);
  if (!site) throw new Error(`Deep site watch: no Deep site of kind ${kind}`);
  return site.name;
};
