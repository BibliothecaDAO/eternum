import { currentArmy, deepTerrain } from "./deep";
import { ruinDisappeared } from "./ruins";
import { isArmyCurrent } from "./expeditions";
import { isTileOccupierArmy } from "./map/hex";
import { TileOccupier } from "@bibliothecadao/types";
import type { NativeKeys, NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { BiomeIdToType, type BiomeType, type Tile } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { configManager } from "../managers/config-manager";
import { tileFactsToTile } from "./tile-facts";

export { tileFactsToTile } from "./tile-facts";
export const DEFAULT_COORD_ALT = false;

export function getTileAt(
  store: Pick<NativeFactStore, "get" | "inGame">,
  alt: boolean,
  col: number,
  row: number,
  gameId = configManager.getActiveGameId(),
): Tile | undefined {
  const key = { game_id: gameId, alt, col, row };
  return tileFactsToTile(key, deepTerrain(store, key) ?? store.get("TileOpt", key), activeTileOccupancy(store, key));
}

/** The canonical map position, including an army garrisoned in a Deep site; a missing position is an incomplete fact set. */
export function entityMapPosition(
  store: Pick<NativeFactStore, "entityOccupancy" | "get">,
  gameId: number,
  entityId: number | bigint,
): { x: number; y: number; alt: boolean } {
  const guard = store.get("DeepGuard", { game_id: gameId, explorer_id: BigInt(entityId) });
  const tile = store.entityOccupancy(gameId, guard?.site_id ?? entityId);
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

/** Occupancy as commands see it: expired armies and vanished ruins leave walkable terrain without erasing the raw facts. */
export function activeTileOccupancy(
  store: Pick<NativeFactStore, "get" | "inGame">,
  key: NativeKeys["TileOccupancy"],
): NativeRows["TileOccupancy"] | undefined {
  const occupancy = store.get("TileOccupancy", key);
  if (occupancy && isTileOccupierArmy(occupancy.category) && !isArmyCurrent(store, key.game_id, occupancy.entity_id))
    return undefined;
  if (occupancy && isTileOccupierArmy(occupancy.category)) {
    const army = store.get("ExplorerTroops", { game_id: key.game_id, explorer_id: occupancy.entity_id });
    if (army && currentArmy(store, army).troops.count === 0n) return undefined;
  }
  if (occupancy?.category !== TileOccupier.Ruin) return occupancy;
  const site = store.get("ExpeditionSite", { game_id: key.game_id, entity_id: occupancy.entity_id });
  return site && ruinDisappeared(store, site) ? undefined : occupancy;
}
