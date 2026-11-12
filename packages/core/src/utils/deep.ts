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
