import { dayOf } from "./days";
import type { NativeFactStore } from "../client/native-fact-store";
import {
  nativeReleaseConstants,
  type NativeKeys,
  type NativeRows,
} from "../../../../contracts/l3/world-native/schema/client.gen";
import { StructureType, TileOccupier } from "@bibliothecadao/types";
import { entityHomeNamespace } from "./entity-home";
import { type ExpeditionRules, seasonDay } from "./expeditions";
import { researchedDepth } from "./realm-research";

type RuinReader = Pick<NativeFactStore, "get" | "inGame">;

export function ruinLimitPerDepth(store: Pick<RuinReader, "get">, gameId: number): boolean {
  const perDepth = perDepthRuins(store, gameId);
  if (perDepth === undefined) throw new Error("A ruin requires its game release");
  return perDepth;
}

/** Whether a home clears one ruin per depth a day (release 9 on); unknown while the game's release is. */
const perDepthRuins = (store: Pick<RuinReader, "get">, gameId: number): boolean | undefined => {
  const release = store.get("GameRelease", { game_id: gameId });
  return release && release.release_id >= nativeReleaseConstants.RUIN_DEPTH_LIMIT_RELEASE;
};

/** The band (day × 4 + depth) of a ruin the home has cleared, from its clear receipt; none for any other site. */
const homeClearBand = (row: NativeRows["ExpeditionSite"], home: number, spacing: number): number | null =>
  row.category === StructureType.Ruin && row.clear !== null && entityHomeNamespace(row.clear.home_id) === home
    ? Math.floor(row.row / spacing)
    : null;

/** A clear closes other ruins at the same depth in its home namespace and map day; stored receipts remain visible. */
export function ruinDisappeared(store: RuinReader, site: NativeRows["ExpeditionSite"]): boolean {
  if (site.category !== StructureType.Ruin || site.clear) return false;
  const spacing = store.get("SettlementRules", { game_id: site.game_id })?.spacing;
  if (!spacing) throw new Error("A ruin requires its expedition spacing");
  const region = Math.floor(site.row / spacing);
  const home = entityHomeNamespace(site.entity_id);
  if (!ruinLimitPerDepth(store, site.game_id)) {
    const day = BigInt(Math.floor(region / 4));
    return [...store.inGame("ExpeditionDiscovery", site.game_id)].some(
      (row) => row.epoch === day && entityHomeNamespace(row.structure_id) === home && row.ruin_cleared,
    );
  }
  return [...store.inGame("ExpeditionSite", site.game_id)].some((row) => homeClearBand(row, home, spacing) === region);
}

/** A depth's ruin chest today: still to take, taken (the home cleared that depth's ruin today), or not researched. */
export type RuinChest = "open" | "claimed" | "locked";
/** Each depth's chest, the Surface then Ethereal I to III. */
export type RuinChests = readonly [RuinChest, RuinChest, RuinChest, RuinChest];

/**
 * Each depth's ruin chest today for a home, the Surface then Ethereal I to III: claimed where its clear receipts show a
 * ruin cleared in that depth's band of today's map (the contract's per-depth entitlement), locked past the deepest
 * layer the realm has researched. None outside the season, before per-depth ruins, or while the release is unknown.
 */
export function ruinChestsToday(
  store: RuinReader,
  rules: ExpeditionRules,
  realm: Pick<NativeRows["Structure"], "game_id" | "entity_id">,
  nowSeconds: number,
): RuinChests | null {
  const today = seasonDay(rules, nowSeconds);
  if (today === null || !perDepthRuins(store, realm.game_id)) return null;
  const home = entityHomeNamespace(realm.entity_id);
  const claimed = new Set<number>();
  for (const row of store.inGame("ExpeditionSite", realm.game_id)) {
    const band = homeClearBand(row, home, rules.spacing);
    if (band !== null && Math.floor(band / 4) === today) claimed.add(band % 4);
  }
  const deepest = researchedDepth(store, realm.game_id, realm.entity_id) ?? 0;
  const chest = (depth: number): RuinChest => (depth > deepest ? "locked" : claimed.has(depth) ? "claimed" : "open");
  return [chest(0), chest(1), chest(2), chest(3)];
}

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
