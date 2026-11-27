import {
  readDeepSites,
  NativeFactStore,
  type DeepSiteView,
  type NativeRows,
} from "@bibliothecadao/eternum/game-client";
import { readGameFacts, type ReleaseCatalogue } from "./game-facts";
import { dayOf, expeditionDepth, readExpeditionRules } from "@bibliothecadao/eternum/expeditions";
import { STAMINA_MODELS } from "@bibliothecadao/eternum/troop-stamina";
import { clearsEveryDefender, mapCenter, readCombatRules, reachableDepth } from "@bibliothecadao/eternum";

export interface DeepSiteWatch {
  gameId: number;
  actor: string;
  owner: string;
  home: string;
  kind: number;
  siteId: string;
  day: number;
  dueAt: number;
  attempts: number;
  until: number;
  siteName: string;
  col: number;
  row: number;
}

export interface DeepRingOpening {
  gameId: number;
  owner: string;
  ring: number;
  day: number;
  sites: number;
  col: number;
  row: number;
  until: number;
}

type Player = Pick<DeepSiteWatch, "gameId" | "actor" | "owner">;

interface DeepReach {
  army: NativeRows["ExplorerTroops"];
  sites: DeepSiteView[];
  day: { index: number; end: number };
  timestamp: number;
  center: number;
}

function deepReach(store: NativeFactStore, player: Player, now: number): DeepReach | undefined {
  const gameId = player.gameId;
  if (!store.get("DeepRules", { game_id: gameId })) return undefined;
  const calendar = readExpeditionRules(store, gameId);
  if (!calendar) throw new Error("Deep alerts require expedition rules");
  const timestamp = Math.floor(now / 1000);
  const day = dayOf(calendar, timestamp);
  if (!day) return undefined;
  const army = largestOutsideArmy(store, gameId, BigInt(player.actor), day.index);
  if (!army) return undefined;
  const depth = reachableDepth(store, gameId, army.owner);
  if (depth === undefined) throw new Error("Deep alerts require the home's research");
  const sites = readDeepSites(store, timestamp, gameId).filter(
    (site) => site.open && depth > 0 && depth >= expeditionDepth(calendar, site.position),
  );
  const center = mapCenter(store.require("SliceRules", { game_id: gameId }).map_center_offset);
  return { army, sites, day, timestamp, center };
}

export function planDeepSiteWatches(store: NativeFactStore, player: Player, now: number): DeepSiteWatch[] {
  const reach = deepReach(store, player, now);
  if (!reach) return [];
  const { army, day, timestamp, center } = reach;
  const gameId = player.gameId;
  const aspect = store.require("HomeAspect", { game_id: gameId, home: army.owner }).aspect;
  const tickSeconds = readCombatRules(store, gameId).tickSeconds;
  const watches: DeepSiteWatch[] = [];
  for (const site of reach.sites) {
    if (site.beastTroops > 0n) continue;
    if (site.aspect === aspect) continue;
    const due = site.garrisons.length
      ? firstTakeableTick(store, army, site.id, timestamp, day.end, tickSeconds)
      : timestamp;
    if (due === null) continue;
    watches.push({
      ...player,
      home: String(army.owner),
      kind: site.kind,
      siteId: String(site.id),
      siteName: site.name,
      col: site.position.x - center,
      row: site.position.y - center,
      day: day.index,
      dueAt: due * 1000,
      attempts: 0,
      until: day.end * 1000,
    });
  }
  return watches;
}

export function planDeepRingOpenings(store: NativeFactStore, player: Player, now: number): DeepRingOpening[] {
  const reach = deepReach(store, player, now);
  if (!reach) return [];
  const opened = new Map<number, DeepSiteView>();
  for (const site of reach.sites) {
    const previous = opened.get(site.ring);
    if (site.ring > 0 && (!previous || site.kind < previous.kind)) opened.set(site.ring, site);
  }
  return [...opened.values()].map((site) => ({
    gameId: player.gameId,
    owner: player.owner,
    ring: site.ring,
    day: reach.day.index,
    sites: reach.sites.filter((candidate) => candidate.ring === site.ring).length,
    col: site.position.x - reach.center,
    row: site.position.y - reach.center,
    until: reach.day.end * 1000,
  }));
}

function largestOutsideArmy(store: NativeFactStore, gameId: number, actor: bigint, day: number) {
  let largest: NativeRows["ExplorerTroops"] | undefined;
  for (const army of store.inGame("ExplorerTroops", gameId)) {
    if (army.troops.count === 0n) continue;
    if (store.require("Structure", { game_id: gameId, entity_id: army.owner }).owner !== actor) continue;
    const key = { game_id: gameId, explorer_id: army.explorer_id };
    if (store.get("DeepArmy", key)) continue;
    if (store.require("ArmyDay", key).day !== BigInt(day)) continue;
    if (
      !largest ||
      army.troops.count > largest.troops.count ||
      (army.troops.count === largest.troops.count && army.explorer_id < largest.explorer_id)
    )
      largest = army;
  }
  return largest;
}

function firstTakeableTick(
  store: NativeFactStore,
  army: NativeRows["ExplorerTroops"],
  siteId: bigint,
  now: number,
  end: number,
  tickSeconds: number,
): number | null {
  const attacker = { game_id: army.game_id, entity_id: army.explorer_id };
  const target = { game_id: army.game_id, entity_id: siteId };
  for (let at = now; at < end; at = (Math.floor(at / tickSeconds) + 1) * tickSeconds) {
    const site = readDeepSites(store, at, army.game_id).find((candidate) => candidate.id === siteId);
    if (!site) return null;
    if (!site.garrisons.length) return site.beastTroops > 0n ? null : at;
    const clears = clearsEveryDefender(store, attacker, target, at, { besideTarget: true });
    if (clears === undefined) throw new Error("Deep alert is missing the fight's combat facts");
    if (clears) return at;
  }
  return null;
}

/** One confirmed, scoped read holds the player's armies and every public Deep guard. */
export async function readDeepAlerts(
  shardUrl: string,
  player: Player,
  now: number,
  catalogue: ReleaseCatalogue,
): Promise<{ sites: DeepSiteWatch[]; rings: DeepRingOpening[] }> {
  const store = await readGameFacts(
    shardUrl,
    player.gameId,
    [
      ...STAMINA_MODELS,
      "PlayerEntry",
      "RealmKnowledge",
      "ArmyRelicEffect",
      "DeepSite",
      "DeepEntries",
      "DeepTick",
      "GarrisonSlot",
      "Guard",
    ],
    now,
    { actor: player.actor },
    catalogue,
  );
  return { sites: planDeepSiteWatches(store, player, now), rings: planDeepRingOpenings(store, player, now) };
}
