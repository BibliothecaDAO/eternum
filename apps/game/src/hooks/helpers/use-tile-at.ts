import { biomeTypeOf, configManager, tileFactsToTile } from "@bibliothecadao/eternum";
import { useNativeRow } from "@/hooks/helpers/use-native-facts";
import type { BiomeType, Tile } from "@bibliothecadao/types";
import { useMemo } from "react";

/** Follows the tile at a contract hex on its own layer. */
export function useTileAt(col: number | undefined, row: number | undefined, alt = false): Tile | undefined {
  const coord = col === undefined || row === undefined ? undefined : { x: col, y: row };
  const key = coord && { game_id: configManager.getActiveGameId(), alt, col: coord.x, row: coord.y };
  const terrain = useNativeRow("TileOpt", key);
  const occupancy = useNativeRow("TileOccupancy", key);
  return useMemo(
    () => (col === undefined || row === undefined ? undefined : tileFactsToTile({ alt, col, row }, terrain, occupancy)),
    [alt, col, row, terrain, occupancy],
  );
}

/** The tile's biome as the chain stored it (see storedBiomeAt); undefined until a command reveals the tile. */
export function useStoredBiome(col: number | undefined, row: number | undefined, alt = false): BiomeType | undefined {
  const tile = useTileAt(col, row, alt);
  return tile && tile.biome !== 0 ? biomeTypeOf(tile.biome) : undefined;
}
