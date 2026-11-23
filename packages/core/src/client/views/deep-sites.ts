import { inlineTroops, resolveExplorerCombatTroops } from "../../managers/troop-stamina";
import { armyOaths } from "../../utils/oaths";
import { currentArmy } from "../../utils/deep";
import { deepSites } from "@bibliothecadao/types";
import { type NativeRows } from "../../../../../contracts/l3/world-native/schema/client.gen";
import { nativeRuleConstants } from "../../../../../contracts/l3/world-native/schema/balance.gen";
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
  ring: number;
  open: boolean;
  opensAt: number;
  buildingPay: number;
  day: number;
  beastTroops: bigint;
  guard: NativeRows["Guard"] | undefined;
  /** Defensive order: the highest live slot is faced next. */
  guards: { slot: number; army: NativeRows["ExplorerTroops"] }[];
}

export class IncompleteDeepSyncError extends Error {}

export function readDeepSites(
  store: NativeFactStore,
  timestamp: number,
  gameId = configManager.getActiveGameId(),
): DeepSiteView[] {
  const today = readDeepDay(store, timestamp, gameId);
  if (!today) return [];
  const rows = [...store.inGame("DeepSite", gameId)];
  if (rows.length !== today.rules.rings.length * nativeRuleConstants.DEEP_RING_SITES) {
    throw new IncompleteDeepSyncError("Incomplete Deep site facts");
  }
  return rows
    .sort((left, right) => left.ring - right.ring || Number(left.entity_id - right.entity_id))
    .map((site) => deepSiteView(store, today, site, timestamp));
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

export function readDeepBeastTroops(
  store: NativeFactStore,
  timestamp: number,
  siteId: bigint,
  gameId = configManager.getActiveGameId(),
): bigint | undefined {
  const site = store.get("DeepSite", { game_id: gameId, entity_id: siteId });
  const today = site && readDeepDay(store, timestamp, gameId);
  return site && today ? todaysBeast(store, today, site).troops : undefined;
}

export function readDeepRingOpening(
  store: NativeFactStore,
  timestamp: number,
  siteId: bigint,
  gameId = configManager.getActiveGameId(),
): RingOpening | undefined {
  const site = store.get("DeepSite", { game_id: gameId, entity_id: siteId });
  const today = site && readDeepDay(store, timestamp, gameId);
  if (!site || !today) return undefined;
  return ringOpening(store, today, site, siteRing(today, site));
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
  const gameId = site.game_id;
  const { current, guard, troops } = todaysBeast(store, today, site);
  const entered = requireEntered(realmsEntered(store, gameId, today));
  const isOpen = (row: NativeRows["DeepSite"]) => ringOpens(entered, siteRing(today, row));
  const payingAt = Math.max(entered, siteRing(today, site).realms);
  const openOfKind = [...store.inGame("DeepSite", gameId)].filter(
    (row) => row.kind === site.kind && ringOpens(payingAt, siteRing(today, row)),
  ).length;
  return {
    id: site.entity_id,
    kind: kind.id,
    name: kind.name,
    position: entityMapPosition(store, gameId, site.entity_id),
    ring: site.ring,
    open: isOpen(site),
    opensAt: siteRing(today, site).realms,
    buildingPay: deepBuildingPay(today.rules.building_pay, openOfKind),
    day: today.index,
    beastTroops: troops,
    guard,
    guards: current ? readGuards(store, gameId, site.entity_id, timestamp) : [],
  };
}

export function deepBuildingPay(pay: NativeRows["DeepRules"]["building_pay"], open: number): number {
  if (open < 1) throw new Error("A closed Deep site pays nothing");
  return open === 1 ? pay.alone : open === 2 ? pay.pair : pay.crowd;
}

function todaysBeast(store: NativeFactStore, today: DeepDay, site: NativeRows["DeepSite"]) {
  if (site.day > BigInt(today.index)) throw new Error("Deep site is ahead of the game clock");
  const current = site.day === BigInt(today.index);
  const guard = current
    ? store.require("Guard", { game_id: site.game_id, structure_id: site.entity_id, slot: 0 })
    : undefined;
  const beast = today.rules.beasts[site.kind];
  if (!beast) throw new Error(`Site ${site.entity_id} is outside its preset rules`);
  return { current, guard, troops: guard ? guard.troops.count : beast.count };
}

type RingOpening = { known: { open: boolean; realms: number } } | { unknown: string };
type DeepRing = NativeRows["DeepRules"]["rings"][number];

const ringOpens = (entered: number, ring: DeepRing): boolean => entered >= ring.realms;

function siteRing(today: DeepDay, site: NativeRows["DeepSite"]): DeepRing {
  const ring = today.rules.rings[site.ring];
  if (!ring) throw new Error(`Site ${site.entity_id} is outside its preset rules`);
  return ring;
}

function ringOpening(
  store: NativeFactStore,
  today: DeepDay,
  site: NativeRows["DeepSite"],
  ring: DeepRing,
): RingOpening {
  const entered = realmsEntered(store, site.game_id, today);
  if ("unknown" in entered) return entered;
  return { known: { open: ringOpens(entered.known, ring), realms: ring.realms } };
}

function realmsEntered(
  store: NativeFactStore,
  gameId: number,
  today: DeepDay,
): { known: number } | { unknown: string } {
  const entries = store.requireOrAbsent("DeepEntries", { game_id: gameId, day: BigInt(today.index) });
  return entries.known ? { known: entries.known.count } : { unknown: entries.unknown };
}

function requireEntered(entered: { known: number } | { unknown: string }): number {
  if ("unknown" in entered) throw new IncompleteDeepSyncError(`Realms entered today are unknown: ${entered.unknown}`);
  return entered.known;
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
