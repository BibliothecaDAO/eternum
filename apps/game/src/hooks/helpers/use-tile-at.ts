import { configManager, tileOptToTile } from "@bibliothecadao/eternum";
import { useNativeRow } from "@/hooks/helpers/use-native-facts";
import type { Tile } from "@bibliothecadao/types";
import { useMemo } from "react";

/** Follows the tile at a contract hex on its own layer. */
export function useTileAt(col: number | undefined, row: number | undefined, alt = false): Tile | undefined {
  const coord = col === undefined || row === undefined ? undefined : { x: col, y: row };
  const tile = useNativeRow(
    "TileOpt",
    coord && { game_id: configManager.getActiveGameId(), alt, col: coord.x, row: coord.y },
  );
  return useMemo(() => (tile ? tileOptToTile(tile) : undefined), [tile]);
}
