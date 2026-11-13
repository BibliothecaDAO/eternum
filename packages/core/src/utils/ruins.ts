import { dayOf } from "./days";
import type { NativeFactStore } from "../client/native-fact-store";
import {
  nativeReleaseConstants,
  type NativeKeys,
  type NativeRows,
} from "../../../../contracts/l3/world-native/schema/client.gen";
import { StructureType, TileOccupier } from "@bibliothecadao/types";
import { entityHomeNamespace } from "./entity-home";
import { type ExpeditionRules, expeditionRealmSite, seasonDay } from "./expeditions";
import { regionInGameSyncScope } from "../sync/model-manifest";
import { researchedDepth } from "./realm-research";

type RuinReader = Pick<NativeFactStore, "get" | "inGame">;

/** The preset chooses whether ruins have an entitlement; the pinned release chooses its historical scope. */
export function ruinLimit(store: Pick<RuinReader, "get">, gameId: number): "none" | "home" | "depth" | undefined {
  const rules = store.get("SliceRules", { game_id: gameId });
  const release = store.get("GameRelease", { game_id: gameId });
  if (!rules || !release) return undefined;
  if (rules.day_unit_seconds === 0 || !store.get("ChestRules", { game_id: gameId })) return "none";
  return release.release_id >= nativeReleaseConstants.RUIN_DEPTH_LIMIT_RELEASE ? "depth" : "home";
}

/** The band (day × 4 + depth) of a ruin the home has cleared, from its clear receipt; none for any other site. */
const homeClearBand = (row: NativeRows["ExpeditionSite"], home: number, spacing: number): number | null =>
  row.category === StructureType.Ruin && row.clear !== null && entityHomeNamespace(row.clear.home_id) === home
    ? Math.floor(row.row / spacing)
    : null;

/** Historical cash entitlements close sibling ruins; relic ruins and stored clear receipts remain visible. */
export function ruinDisappeared(store: RuinReader, site: NativeRows["ExpeditionSite"]): boolean {
  if (site.category !== StructureType.Ruin || site.clear) return false;
  const limit = ruinLimit(store, site.game_id);
  if (limit === undefined) throw new Error("A ruin requires its game rules and release");
  if (limit === "none") return false;
  const spacing = store.get("SettlementRules", { game_id: site.game_id })?.spacing;
  if (!spacing) throw new Error("A ruin requires its expedition spacing");
  const region = Math.floor(site.row / spacing);
  const home = entityHomeNamespace(site.entity_id);
  if (limit === "home") {
    const day = BigInt(Math.floor(region / 4));
    return [...store.inGame("ExpeditionDiscovery", site.game_id)].some(
      (row) => row.epoch === day && entityHomeNamespace(row.structure_id) === home && row.ruin_cleared,
    );
  }
  return [...store.inGame("ExpeditionSite", site.game_id)].some((row) => homeClearBand(row, home, spacing) === region);
}

/**
 * A depth's ruin chest today: still to take, taken (the home cleared that depth's ruin today), not known here (some
 * depth was cleared today and this depth's region is outside what the client holds), or not researched.
 */
export type RuinChest = "open" | "claimed" | "unknown" | "locked";
/** Each depth's chest, the Surface then Ethereal I to III. */
export type RuinChests = readonly [RuinChest, RuinChest, RuinChest, RuinChest];

type ChestReader = Pick<NativeFactStore, "get" | "inGame" | "requireOrAbsent" | "subscriptionScope">;

/**
 * Today's clears as the home's own history shows them: the depths it places, and whether it is `complete`, holding
 * every story of the day through the snapshot the store holds, each payout placed.
 */
export interface RuinHistory {
  cleared: ReadonlySet<number>;
  complete: boolean;
}
const NO_HISTORY: RuinHistory = { cleared: new Set(), complete: false };

/**
 * Each depth's ruin chest today for a home, the Surface then Ethereal I to III. The contract keeps the per-depth
 * entitlement in storage no row carries, so it is read from what does. Claimed: the home's clear receipts in each
 * depth's band of today's map, and the depths its own history (Herald's immutable sink) shows cleared today. Open: a
 * depth neither shows is open when that history is `complete` (it holds the whole day through the snapshot the store
 * holds, and places every payout) and today's discovery row does not contradict it (a clear the history lacks); or when
 * the discovery row, which every home receives whatever its armies' positions, says nothing was cleared today; or when
 * the depth's region is in the client's scope, where a missing receipt means none. Else unknown, never open. Locked past
 * the deepest layer researched. None without a cash entitlement, outside the season, before per-depth ruins, or while
 * the release is unknown.
 */
export function ruinChestsToday(
  store: ChestReader,
  rules: ExpeditionRules,
  realm: Pick<NativeRows["Structure"], "game_id" | "entity_id">,
  nowSeconds: number,
  history: RuinHistory = NO_HISTORY,
): RuinChests | null {
  const today = seasonDay(rules, nowSeconds);
  if (today === null || ruinLimit(store, realm.game_id) !== "depth") return null;
  const home = entityHomeNamespace(realm.entity_id);
  const claimed = new Set<number>();
  for (const row of store.inGame("ExpeditionSite", realm.game_id)) {
    const band = homeClearBand(row, home, rules.spacing);
    if (band !== null && Math.floor(band / 4) === today) claimed.add(band % 4);
  }
  const discovery = store.requireOrAbsent("ExpeditionDiscovery", {
    game_id: realm.game_id,
    structure_id: realm.entity_id,
    epoch: BigInt(today),
  }).known;
  const nothingClearedToday = discovery?.ruin_cleared === false;
  // A history that shows no clear while the discovery row has one lags the facts: it proves nothing.
  const historyProves = history.complete && !(discovery?.ruin_cleared === true && history.cleared.size === 0);
  const held = depthRegionHeld(store, rules, home, nowSeconds);
  const deepest = researchedDepth(store, realm.game_id, realm.entity_id) ?? 0;
  const chest = (depth: number): RuinChest => {
    if (depth > deepest) return "locked";
    if (claimed.has(depth) || history.cleared.has(depth)) return "claimed";
    return historyProves || nothingClearedToday || held(depth) ? "open" : "unknown";
  };
  return [chest(0), chest(1), chest(2), chest(3)];
}

/** Whether the client holds every row of the home's region at a depth today: where a missing receipt means none. */
const depthRegionHeld = (store: ChestReader, rules: ExpeditionRules, home: number, nowSeconds: number) => {
  const scope = store.subscriptionScope().known;
  const site = expeditionRealmSite(rules, home, nowSeconds);
  return (depth: number) =>
    scope !== undefined &&
    site !== null &&
    // Today's site is on the Surface; each depth lies a region further down the same column.
    regionInGameSyncScope(scope, { x: site.col, y: site.row + depth * rules.spacing });
};

/** Occupancy as commands see it: a vanished ruin leaves walkable terrain without erasing the raw facts. */
export function activeTileOccupancy(
  store: RuinReader,
  key: NativeKeys["TileOccupancy"],
): NativeRows["TileOccupancy"] | undefined {
  const occupancy = store.get("TileOccupancy", key);
  if (occupancy?.category !== TileOccupier.Ruin) return occupancy;
  const site = store.get("ExpeditionSite", { game_id: key.game_id, entity_id: occupancy.entity_id });
  return site && ruinDisappeared(store, site) ? undefined : occupancy;
}

/** Whole LORDS available now, releasing yesterday's holds when the calendar has advanced. */
export function availableRuinLords(store: Pick<NativeFactStore, "get">, gameId: number, timestamp: number): bigint {
  const budget = store.get("LordsBudget", { game_id: gameId });
  if (!budget || budget.pool === 0n) return 0n;
  const game = store.get("GameRegistry", { game_id: gameId });
  const rules = store.get("SliceRules", { game_id: gameId });
  if (!game || !rules) throw new Error("A ruin budget requires its game and calendar");
  const start = Number(game.start_main_at);
  const end = Number(game.end_at);
  const day = dayOf(
    { startMainAt: start, endAt: end, dayUnitSeconds: rules.day_unit_seconds, seed: game.seed },
    timestamp,
  );
  if (!day) return 0n;
  const unlocked = (budget.pool * BigInt(day.end - start)) / BigInt(end - start);
  const held = budget.day === BigInt(day.index) ? budget.open : 0n;
  const available = unlocked - (budget.pool - budget.pool_left) - held;
  return available > 0n ? available : 0n;
}
