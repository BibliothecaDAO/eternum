import { deepCenter, isDeepTile } from "./deep-geometry";
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

/** Fixed terrain is a view of the native Deep rules, without a reveal or a second tile store. */
export function deepTerrain(
  store: Pick<NativeFactStore, "get">,
  key: Pick<NativeRows["TileOpt"], "game_id" | "alt" | "col" | "row">,
): Pick<NativeRows["TileOpt"], "data"> | undefined {
  if (!store.get("DeepRules", { game_id: key.game_id })) return undefined;
  const settlement = store.get("SettlementRules", { game_id: key.game_id });
  if (!settlement || !isDeepTile(settlement.spacing, key)) return undefined;
  return { data: BigInt(BiomeTypeToId[BiomeType.Underground]) * BigInt(nativeTilePackingConstants.BIOME_SCALE) };
}

export function* deepTiles(
  store: Pick<NativeFactStore, "entries" | "get">,
): Generator<Pick<NativeRows["TileOpt"], "game_id" | "alt" | "col" | "row">> {
  for (const [, rules] of store.entries("DeepRules")) {
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
  const key = { game_id: army.game_id, explorer_id: army.explorer_id };
  const deep = store.get("DeepArmy", key);
  if (!deep) return army;
  const rules = store.get("DeepRules", { game_id: army.game_id });
  const slice = store.get("SliceRules", { game_id: army.game_id });
  const birth = store.get("ArmyDay", key);
  const source = store.get("ExplorerTroops", key);
  if (!rules || !slice || !birth || !source) throw new Error("Deep attrition requires its rules and army facts");
  const calendar = readExpeditionRules(store, army.game_id);
  if (!calendar) throw new Error("Deep attrition requires expedition days");
  const end = dayAtIndex(calendar, Number(birth.day)).end;
  const interval = Number(slice.tick_config.armies_tick_in_seconds);
  if (interval <= 0 || rules.loss_per_tick <= 0n) throw new Error("Invalid Deep tick rules");
  const now = timestamp ?? getBlockTimestamp().currentDefaultTick;
  const tick = BigInt(Math.floor(Math.min(now, end) / interval));
  const elapsed = tick > deep.last_tick ? tick - deep.last_tick : 0n;
  const loss = elapsed * rules.loss_per_tick;
  const count = loss >= source.troops.count ? 0n : source.troops.count - loss;
  return { ...source, troops: { ...source.troops, count } };
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
