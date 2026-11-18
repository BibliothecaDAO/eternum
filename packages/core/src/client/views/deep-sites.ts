import { inlineTroops, resolveExplorerCombatTroops } from "../../managers/troop-stamina";
import { armyOaths } from "../../utils/oaths";
import { currentArmy } from "../../utils/deep";
import { deepSites } from "@bibliothecadao/types";
import { nativeRuleConstants, type NativeRows } from "../../../../../contracts/l3/world-native/schema/client.gen";
import type { NativeFactStore } from "../native-fact-store";
import { configManager } from "../../managers/config-manager";
import { dayOf, readExpeditionRules } from "../../utils/expeditions";
import { entityMapPosition } from "../../utils/tile";
import { journeyDistance } from "../../utils/travel";

export interface DeepSiteView {
  id: bigint;
  kind: (typeof deepSites)[number]["id"];
  name: (typeof deepSites)[number]["name"];
  position: { x: number; y: number; alt: boolean };
  day: number;
  beastTroops: bigint;
  guard: NativeRows["Guard"] | undefined;
  /** Defensive order: the highest live slot is faced next. */
  guards: { slot: number; army: NativeRows["ExplorerTroops"] }[];
}

export function readDeepSites(
  store: NativeFactStore,
  timestamp: number,
  gameId = configManager.getActiveGameId(),
): DeepSiteView[] {
  const today = readDeepDay(store, timestamp, gameId);
  if (!today) return [];
  const rows = [...store.inGame("DeepSite", gameId)];
  if (rows.length !== nativeRuleConstants.DEEP_SITE_COUNT) throw new Error("Incomplete Deep site facts");
  return deepSites.map((kind) => {
    const sites = rows.filter((row) => row.kind === kind.id);
    if (sites.length !== 1) throw new Error(`Expected one ${kind.name} site`);
    return deepSiteView(store, today, sites[0]!, timestamp);
  });
}

export function readDeepSite(
  store: NativeFactStore,
  timestamp: number,
  siteId: bigint,
  gameId = configManager.getActiveGameId(),
): DeepSiteView | undefined {
  const site = store.get("DeepSite", { game_id: gameId, entity_id: siteId });
  const today = site && readDeepDay(store, timestamp, gameId);
  return site && today ? deepSiteView(store, today, site, timestamp) : undefined;
}

interface DeepDay {
  rules: NativeRows["DeepRules"];
  index: number;
}

function readDeepDay(store: NativeFactStore, timestamp: number, gameId: number): DeepDay | undefined {
  const rules = store.get("DeepRules", { game_id: gameId });
  if (!rules) {
    if ([...store.inGame("DeepSite", gameId)].length) throw new Error("Deep sites are missing their preset rules");
    return undefined;
  }
  const calendar = readExpeditionRules(store, gameId);
  if (!calendar) throw new Error("Deep sites require expedition rules");
  const day = dayOf(calendar, timestamp);
  return day ? { rules, index: day.index } : undefined;
}

function deepSiteView(
  store: NativeFactStore,
  today: DeepDay,
  site: NativeRows["DeepSite"],
  timestamp: number,
): DeepSiteView {
  const kind = deepSites.find((candidate) => candidate.id === site.kind);
  if (!kind) throw new Error(`Unknown site kind ${site.kind}`);
  if (site.day > BigInt(today.index)) throw new Error("Deep site is ahead of the game clock");
  const gameId = site.game_id;
  const current = site.day === BigInt(today.index);
  const guard = current
    ? store.require("Guard", { game_id: gameId, structure_id: site.entity_id, slot: 0 })
    : undefined;
  return {
    id: site.entity_id,
    kind: kind.id,
    name: kind.name,
    position: entityMapPosition(store, gameId, site.entity_id),
    day: today.index,
    beastTroops: guard ? guard.troops.count : today.rules.beast_count,
    guard,
    guards: current ? readGuards(store, gameId, site.entity_id, timestamp) : [],
  };
}

export function homeAspect(store: NativeFactStore, gameId: number, home: bigint): number {
  return store.require("HomeAspect", { game_id: gameId, home }).aspect;
}

export function isDeepSiteRival(store: NativeFactStore, site: DeepSiteView, attackerHome: bigint): boolean {
  const holder = site.guards[0]?.army;
  return (
    holder !== undefined &&
    homeAspect(store, holder.game_id, holder.owner) !== homeAspect(store, holder.game_id, attackerHome)
  );
}

export function isBesideDeepSite(tile: { col: number; row: number; alt: boolean }, site: DeepSiteView): boolean {
  return tile.alt === site.position.alt && journeyDistance({ x: tile.col, y: tile.row }, site.position) === 1;
}

export function readDeepSiteDefender(store: NativeFactStore, site: DeepSiteView, timestamp: number) {
  const army = site.guards[0]?.army;
  if (army) {
    const troops = resolveExplorerCombatTroops(store, army, timestamp);
    return troops && { troops, oaths: armyOaths(store, army), guarding: true };
  }
  if (!site.guard || site.beastTroops === 0n) return undefined;
  const rules = store.require("SliceRules", { game_id: site.guard.game_id });
  return { troops: inlineTroops(site.guard.troops, rules), oaths: 0, guarding: false };
}

function readGuards(store: NativeFactStore, gameId: number, siteId: bigint, timestamp: number): DeepSiteView["guards"] {
  const guards = [...store.inGame("DeepGuard", gameId)]
    .filter((guard) => guard.site_id === siteId)
    .sort((left, right) => right.slot - left.slot);
  const slots = new Set<number>();
  return guards
    .map(({ slot, explorer_id }) => {
      if (slot >= nativeRuleConstants.DEEP_GUARD_SLOTS || slots.has(slot)) throw new Error("Invalid Deep guard slots");
      slots.add(slot);
      return {
        slot,
        army: currentArmy(store, store.require("ExplorerTroops", { game_id: gameId, explorer_id }), timestamp),
      };
    })
    .filter(({ army }) => army.troops.count > 0n);
}
