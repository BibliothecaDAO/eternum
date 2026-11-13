import { dayAtIndex } from "./days";
import { readExpeditionRules } from "./expeditions";
import { getBlockTimestamp } from "./timestamp";
import {
  nativeRuleConstants,
  nativeTilePackingConstants,
  type NativeRows,
} from "../../../../contracts/l3/world-native/schema/client.gen";
import { BiomeTypeToId, BiomeType } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";

export function deepCenter(spacing: number): { col: number; row: number } {
  if (spacing < nativeRuleConstants.DEEP_MAP_SIZE * 2) throw new Error("Deep needs a full expedition region");
  return { col: Math.floor(spacing / 2), row: spacing * 3 + Math.floor(spacing / 2) };
}

function isDeepTile(spacing: number, tile: { col: number; row: number; alt: boolean }): boolean {
  if (tile.alt || spacing < nativeRuleConstants.DEEP_MAP_SIZE * 2) return false;
  const center = deepCenter(spacing);
  const half = nativeRuleConstants.DEEP_MAP_SIZE / 2;
  return (
    tile.col >= center.col - half &&
    tile.col < center.col + half &&
    tile.row >= center.row - half &&
    tile.row < center.row + half
  );
}

/** Fixed terrain is a view of the native expedition rules, without a reveal or a second tile store. */
export function deepTerrain(
  store: Pick<NativeFactStore, "get">,
  key: Pick<NativeRows["TileOpt"], "game_id" | "alt" | "col" | "row">,
): Pick<NativeRows["TileOpt"], "data"> | undefined {
  const rules = store.get("SliceRules", { game_id: key.game_id });
  if (!rules || rules.day_unit_seconds === 0) return undefined;
  const settlement = store.get("SettlementRules", { game_id: key.game_id });
  if (!settlement || !isDeepTile(settlement.spacing, key)) return undefined;
  return { data: BigInt(BiomeTypeToId[BiomeType.Underground]) * BigInt(nativeTilePackingConstants.BIOME_SCALE) };
}

export function* deepTiles(
  store: Pick<NativeFactStore, "entries" | "get">,
): Generator<Pick<NativeRows["TileOpt"], "game_id" | "alt" | "col" | "row">> {
  for (const [, rules] of store.entries("SliceRules")) {
    if (rules.day_unit_seconds === 0) continue;
    const settlement = store.get("SettlementRules", { game_id: rules.game_id });
    if (!settlement || settlement.spacing < nativeRuleConstants.DEEP_MAP_SIZE * 2) continue;
    const center = deepCenter(settlement.spacing);
    const half = nativeRuleConstants.DEEP_MAP_SIZE / 2;
    for (let col = center.col - half; col < center.col + half; col++)
      for (let row = center.row - half; row < center.row + half; row++)
        yield { game_id: rules.game_id, alt: false, col, row };
  }
}

/** Derived count only: persisted troops and the last charged tick remain the sole native facts. */
export function currentArmy(
  store: Pick<NativeFactStore, "get">,
  army: NativeRows["ExplorerTroops"],
  timestamp?: number,
): NativeRows["ExplorerTroops"] {
  const clock = deepClock(store, army, timestamp);
  if (!clock) return army;
  const elapsed = clock.tick > clock.deep.last_tick ? clock.tick - clock.deep.last_tick : 0n;
  const loss = elapsed * clock.rules.loss_per_tick;
  const count = loss >= clock.source.troops.count ? 0n : clock.source.troops.count - loss;
  return { ...clock.source, troops: { ...clock.source.troops, count } };
}

/**
 * The army ticks a Deep army has left (`left`), each taking the preset's loss: it is gone when its troops are or when
 * its day ends, whichever comes first. `seconds` is the time until that last tick. Null for an army outside the Deep.
 */
export function deepTicksLeft(
  store: Pick<NativeFactStore, "get">,
  army: NativeRows["ExplorerTroops"],
  timestamp?: number,
): { left: number; seconds: number } | null {
  const clock = deepClock(store, army, timestamp);
  if (!clock) return null;
  const troops = currentArmy(store, army, timestamp).troops.count;
  const byTroops = (troops + clock.rules.loss_per_tick - 1n) / clock.rules.loss_per_tick;
  const byDay = BigInt(Math.floor(clock.end / clock.interval)) - clock.tick;
  const left = Number(byTroops < byDay ? byTroops : byDay > 0n ? byDay : 0n);
  const gone = (Number(clock.tick) + left) * clock.interval;
  return { left, seconds: left === 0 ? 0 : Math.max(0, gone - clock.now) };
}

/** The facts a Deep army's losses are read from, and the army tick it stands at; null outside the Deep. */
function deepClock(store: Pick<NativeFactStore, "get">, army: NativeRows["ExplorerTroops"], timestamp?: number) {
  const key = { game_id: army.game_id, explorer_id: army.explorer_id };
  const deep = store.get("DeepArmy", key);
  if (!deep) return null;
  const rules = store.get("DeepRules", { game_id: army.game_id });
  const slice = store.get("SliceRules", { game_id: army.game_id });
  const birth = store.get("ArmyDay", key);
  const source = store.get("ExplorerTroops", key);
  if (!rules || !slice || !birth || !source) throw new Error("Deep attrition requires its rules and army facts");
  const calendar = readExpeditionRules(store, army.game_id);
  if (!calendar) throw new Error("Deep attrition requires expedition days");
  const { end } = dayAtIndex(calendar, Number(birth.day));
  const interval = Number(slice.tick_config.armies_tick_in_seconds);
  if (interval <= 0 || rules.loss_per_tick <= 0n) throw new Error("Invalid Deep tick rules");
  const now = Math.min(timestamp ?? getBlockTimestamp().currentDefaultTick, end);
  const tick = BigInt(Math.floor(now / interval));
  return { deep, rules, source, end, interval, tick, now };
}

/** The same lost troops remove their carrying capacity when the native command settles them. */
export function currentResourceWeight(
  store: Pick<NativeFactStore, "get">,
  weight: NativeRows["ResourceWeight"],
  timestamp?: number,
): NativeRows["ResourceWeight"] {
  const key = { game_id: weight.game_id, explorer_id: weight.entity_id };
  if (!store.get("DeepArmy", key)) return weight;
  const source = store.get("ResourceWeight", { game_id: weight.game_id, entity_id: weight.entity_id });
  const army = store.get("ExplorerTroops", key);
  const rules = store.get("SliceRules", { game_id: weight.game_id });
  if (!source || !army || !rules) throw new Error("Deep capacity requires its army and rules");
  const loss =
    (army.troops.count - currentArmy(store, army, timestamp).troops.count) *
    BigInt(rules.capacity_config.troop_capacity);
  if (loss > source.capacity) throw new Error("Deep loss exceeds troop capacity");
  return { ...source, capacity: source.capacity - loss };
}
