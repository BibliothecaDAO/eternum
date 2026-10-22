import { dayOf } from "./days";
import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeKeys, NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { StructureType, TileOccupier } from "@bibliothecadao/types";
import { entityHomeNamespace } from "./entity-home";

type RuinReader = Pick<NativeFactStore, "get" | "inGame">;

/** A clear closes all other ruins in its home namespace and map day; stored receipts remain visible. */
export function ruinDisappeared(store: RuinReader, site: NativeRows["ExpeditionSite"]): boolean {
  if (site.category !== StructureType.Ruin || site.clear) return false;
  const spacing = store.get("SettlementRules", { game_id: site.game_id })?.spacing;
  if (!spacing) throw new Error("A ruin requires its expedition spacing");
  const day = Math.floor(site.row / spacing / 4);
  const home = entityHomeNamespace(site.entity_id);
  return [...store.inGame("ExpeditionDiscovery", site.game_id)].some(
    (row) => row.epoch === BigInt(day) && entityHomeNamespace(row.structure_id) === home && row.ruin_cleared,
  );
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
  const day = dayOf({ startMainAt: start, dayUnitSeconds: rules.day_unit_seconds, seed: game.seed }, timestamp);
  if (!day || timestamp >= end) return 0n;
  const unlocked = (budget.pool * BigInt(Math.min(day.end, end) - start)) / BigInt(end - start);
  const held = budget.day === BigInt(day.index) ? budget.open : 0n;
  const available = unlocked - (budget.pool - budget.pool_left) - held;
  return available > 0n ? available : 0n;
}
