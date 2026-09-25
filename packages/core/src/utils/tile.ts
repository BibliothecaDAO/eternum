import { BiomeIdToType, type BiomeType, type Tile } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { configManager } from "../managers/config-manager";
import { tileFactsToTile } from "./tile-facts";

export { tileFactsToTile } from "./tile-facts";
export const DEFAULT_COORD_ALT = false;

export function getTileAt(
  store: NativeFactStore,
  alt: boolean,
  col: number,
  row: number,
  gameId = configManager.getActiveGameId(),
): Tile | undefined {
  const key = { game_id: gameId, alt, col, row };
  return tileFactsToTile(key, store.get("TileOpt", key), store.get("TileOccupancy", key));
}

/** The canonical tile occupied by a live entity; a missing position is an incomplete fact set. */
export function entityMapPosition(
  store: Pick<NativeFactStore, "entityOccupancy">,
  gameId: number,
  entityId: number,
): { x: number; y: number; alt: boolean } {
  const tile = store.entityOccupancy(gameId, entityId);
  if (!tile) throw new Error(`Missing native position for entity ${gameId}:${entityId}`);
  return { x: tile.col, y: tile.row, alt: tile.alt };
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
