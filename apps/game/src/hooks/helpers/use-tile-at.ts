import { configManager, Position, tileOptToTile } from "@bibliothecadao/eternum";
import { useNativeRow } from "@/hooks/helpers/use-native-facts";
import type { Tile } from "@bibliothecadao/types";
import { useMemo } from "react";

/** Accepts normalized or contract coordinates and follows the tile on its own layer. */
export function useTileAt(col: number | undefined, row: number | undefined, alt = false): Tile | undefined {
  const coord = col === undefined || row === undefined ? undefined : new Position({ x: col, y: row }).getContract();
  const tile = useNativeRow(
    "TileOpt",
    coord && { game_id: configManager.getActiveGameId(), alt, col: coord.x, row: coord.y },
  );
  return useMemo(() => (tile ? tileOptToTile(tile) : undefined), [tile]);
}
