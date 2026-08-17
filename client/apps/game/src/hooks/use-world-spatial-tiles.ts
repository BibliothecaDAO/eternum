import { getActiveGameSyncRuntime, type TileSpatialRenderable } from "@bibliothecadao/eternum/game-sync";
import { useEffect, useMemo, useState } from "react";

interface WorldSpatialTileHex {
  col: number;
  row: number;
}

export const useWorldSpatialTiles = (hexes: readonly WorldSpatialTileHex[]): readonly TileSpatialRenderable[] => {
  const projection = getActiveGameSyncRuntime()?.getWorldSpatialProjection();
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!projection) {
      console.error("[useWorldSpatialTiles] WorldSpatialProjection is unavailable for the active game");
      return;
    }

    return projection.subscribeTiles(() => setRevision((current) => current + 1));
  }, [projection]);

  return useMemo(() => hexes.flatMap((hex) => projection?.getTileAtHex(hex) ?? []), [hexes, projection, revision]);
};
