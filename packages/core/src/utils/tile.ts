import { BiomeIdToType, type BiomeType, type Tile } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { configManager } from "../managers/config-manager";
import { tileOptToTile } from "./tile-opt";

export { tileOptToTile } from "./tile-opt";
export const DEFAULT_COORD_ALT = false;

export function getTileAt(
  store: NativeFactStore,
  alt: boolean,
  col: number,
  row: number,
  gameId = configManager.getActiveGameId(),
): Tile | undefined {
  const rowValue = store.get("TileOpt", { game_id: gameId, alt, col, row });
  return rowValue ? tileOptToTile(rowValue) : undefined;
}

/** The biome a tile's stored byte names; an unknown id is a broken fact, never a default. */
export const biomeTypeOf = (biomeId: number): BiomeType => {
  const biome = BiomeIdToType[biomeId];
  if (!biome) throw new Error(`Tile carries unknown biome id ${biomeId}`);
  return biome;
};

/**
 * A revealed tile's biome as the chain stored it, the one source of a tile's biome; undefined where no command has
 * revealed the tile yet. Procedural sampling may decorate within this biome but never chooses it.
 */
export function storedBiomeAt(
  store: NativeFactStore,
  alt: boolean,
  col: number,
  row: number,
  gameId = configManager.getActiveGameId(),
): BiomeType | undefined {
  const tile = getTileAt(store, alt, col, row, gameId);
  return tile && tile.biome !== 0 ? biomeTypeOf(tile.biome) : undefined;
}
