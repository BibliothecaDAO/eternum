import type { TileSpatialRenderable } from "@bibliothecadao/eternum/game-sync";
import { useEffect, useMemo } from "react";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useSpatialProjection } from "@/hooks/use-spatial-projection";

interface WorldSpatialTileHex {
  col: number;
  row: number;
}

const TILE_LAYER = ["tiles"] as const;

export const useWorldSpatialTiles = (hexes: readonly WorldSpatialTileHex[]): readonly TileSpatialRenderable[] => {
  const spatial = useSpatialProjection(TILE_LAYER);
  const mapLayer = useUIStore((state) => state.mapLayer);

  useEffect(() => {
    if (!spatial.projection)
      console.error("[useWorldSpatialTiles] WorldSpatialProjection is unavailable for the active game");
  }, [spatial.projection]);

  return useMemo(
    () => hexes.flatMap((hex) => spatial.projection?.getTileAtHex({ ...hex, alt: mapLayer }) ?? []),
    [hexes, mapLayer, spatial],
  );
};
