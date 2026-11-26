import { inlineTroops } from "../../managers/troop-stamina";
import { deepSites, layerName, TroopType } from "@bibliothecadao/types";
import { type NativeRows } from "../../../../../contracts/l3/world-native/schema/client.gen";
import { nativeRuleConstants } from "../../../../../contracts/l3/world-native/schema/balance.gen";
import type { NativeFactStore } from "../native-fact-store";
import { configManager } from "../../managers/config-manager";
import { dayAtIndex } from "../../utils/days";
import { DEEP_DEPTH, dayOf, readExpeditionRules } from "../../utils/expeditions";
import { entityMapPosition } from "../../utils/tile";
import { journeyDistance } from "../../utils/travel";

export interface DeepSiteView {
  gameId: number;
  id: bigint;
  kind: (typeof deepSites)[number]["id"];
  name: (typeof deepSites)[number]["name"];
  position: { x: number; y: number; alt: boolean };
  ring: number;
  open: boolean;
  opensAt: number;
  entered: number;
  buildingPay: number;
  day: number;
  beastTroops: bigint;
  beastCategory: NativeRows["Guard"]["troops"]["category"];
  guard: NativeRows["Guard"] | undefined;
  aspect: number;
  /** Defensive order: the highest live slot is faced next. */
  garrisons: DeepGarrison[];
}

export interface DeepGarrison {
  slot: number;
  home: bigint;
  troops: NativeRows["Guard"]["troops"];
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
    throw new IncompleteDeepSyncError(`Incomplete ${layerName(DEEP_DEPTH)} site facts`);
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
  const entered = requireEntered(realmsEntered(store, gameId, today));
  const { current, guard, troops, category } = todaysBeast(store, today, site);
  const isOpen = (row: NativeRows["DeepSite"]) => ringOpens(entered, siteRing(today, row));
  const payingAt = Math.max(entered, siteRing(today, site).realms);
  const openOfKind = [...store.inGame("DeepSite", gameId)].filter(
    (row) => row.kind === site.kind && ringOpens(payingAt, siteRing(today, row)),
  ).length;
  return {
    gameId,
    id: site.entity_id,
    kind: kind.id,
    name: kind.name,
    position: entityMapPosition(store, gameId, site.entity_id),
    ring: site.ring,
    open: isOpen(site),
    opensAt: siteRing(today, site).realms,
    entered,
    buildingPay: deepBuildingPay(today.rules.building_pay, openOfKind),
    day: today.index,
    beastTroops: troops,
    beastCategory: category,
    guard,
    aspect: current ? site.aspect : 0,
    garrisons: current ? readGarrisons(store, today, site, timestamp) : [],
  };
}

export function deepBuildingPay(pay: NativeRows["DeepRules"]["building_pay"], open: number): number {
  if (open < 1) throw new Error("A closed Deep site pays nothing");
  return open === 1 ? pay.alone : open === 2 ? pay.pair : pay.crowd;
}

function todaysBeast(store: NativeFactStore, today: DeepDay, site: NativeRows["DeepSite"]) {
  if (site.day > BigInt(today.index)) throw new Error("Deep site is ahead of the game clock");
  const current = site.day === BigInt(today.index);
  const beast = today.rules.beasts[site.kind];
  if (!beast) throw new Error(`Site ${site.entity_id} is outside its preset rules`);
  const category = beast.bow ? TroopType.Crossbowman : TroopType.Knight;
  if (!current) return { current, guard: undefined, troops: beast.count, category };
  const key = { game_id: site.game_id, structure_id: site.entity_id, slot: 0 };
  if (site.aspect !== 0) return { current, guard: store.get("Guard", key), troops: 0n, category };
  const guard = store.get("Guard", key);
  if (!guard && !store.absenceKnown("Guard", key).known)
    throw new IncompleteDeepSyncError(`${layerName(DEEP_DEPTH)} beast is unknown`);
  return { current, guard, troops: guard?.troops.count ?? 0n, category: guard?.troops.category ?? category };
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

export function isDeepSiteRival(
  store: NativeFactStore,
  site: DeepSiteView,
  attackerHome: bigint,
  gameId = configManager.getActiveGameId(),
): boolean {
  return site.aspect !== 0 && site.aspect !== homeAspect(store, gameId, attackerHome);
}

export function isBesideDeepSite(tile: { col: number; row: number; alt: boolean }, site: DeepSiteView): boolean {
  return tile.alt === site.position.alt && journeyDistance({ x: tile.col, y: tile.row }, site.position) === 1;
}

export function readDeepSiteDefender(store: NativeFactStore, site: DeepSiteView) {
  const garrison = site.garrisons[0];
  const troops = garrison?.troops ?? (site.beastTroops > 0n ? site.guard?.troops : undefined);
  if (!troops) return undefined;
  const rules = store.require("SliceRules", { game_id: site.gameId });
  return { troops: inlineTroops(troops, rules), oaths: 0, guarding: garrison !== undefined };
}

function readGarrisons(
  store: NativeFactStore,
  today: DeepDay,
  site: NativeRows["DeepSite"],
  timestamp: number,
): DeepGarrison[] {
  const gameId = site.game_id;
  const slots = [...store.inGame("GarrisonSlot", gameId)].filter((row) => row.structure_id === site.entity_id);
  if (!slots.length) return [];
  const loss = garrisonLoss(store, today, gameId, timestamp);
  return slots
    .sort((left, right) => right.slot - left.slot)
    .map(({ slot, home }) => {
      if (slot >= nativeRuleConstants.DEEP_GUARD_SLOTS) throw new Error("Invalid Deep garrison slot");
      const { troops } = store.require("Guard", { game_id: gameId, structure_id: site.entity_id, slot });
      return { slot, home, troops: { ...troops, count: troops.count > loss ? troops.count - loss : 0n } };
    })
    .filter(({ troops }) => troops.count > 0n);
}

function garrisonLoss(store: NativeFactStore, today: DeepDay, gameId: number, timestamp: number): bigint {
  const paid = store.require("DeepTick", { game_id: gameId }).paid_tick;
  const interval = Number(store.require("SliceRules", { game_id: gameId }).tick_config.armies_tick_in_seconds);
  const calendar = readExpeditionRules(store, gameId);
  if (!calendar || interval <= 0) throw new Error("Deep garrisons require the tick and the calendar");
  const tick = BigInt(Math.floor(Math.min(timestamp, dayAtIndex(calendar, today.index).end) / interval));
  return tick > paid ? (tick - paid) * today.rules.loss_per_tick : 0n;
}
