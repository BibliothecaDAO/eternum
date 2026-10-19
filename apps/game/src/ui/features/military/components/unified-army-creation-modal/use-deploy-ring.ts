import { useGame } from "@/hooks/context/game-context";
import { useWorldSpatialTiles } from "@/hooks/use-world-spatial-tiles";
import { spawnRing, structureMapPosition } from "@bibliothecadao/eternum";
import { type NativeRows, safeInteger } from "@bibliothecadao/eternum/game-client";
import { getNeighborHexes } from "@bibliothecadao/types";
import { useMemo } from "react";

import type { DeployTile } from "./realm-hex-deploy-map";

/**
 * Where a structure's new army can step out: the structure's map position (a Frontier realm's day site, as the contract
 * spawns) and the six tiles around it, each open, taken or unexplored (spawnRing), with the biome the map paints. The
 * one read behind every deploy's map selector.
 */
export const useDeployRing = (
  structure: NativeRows["Structure"] | null | undefined,
): { center: { col: number; row: number } | null; ring: DeployTile[] } => {
  const { setup } = useGame();
  const home = structure ? structureMapPosition(setup.store, structure) : null;
  const neighbors = useMemo(() => (home ? getNeighborHexes(home.x, home.y) : []), [home?.x, home?.y]);
  const tiles = useWorldSpatialTiles(neighbors);
  const ring = useMemo(() => {
    if (!structure) return [];
    const tileAt = (hex: { col: number; row: number }) =>
      tiles.find((candidate) => candidate.hexCoords.col === hex.col && candidate.hexCoords.row === hex.row);
    return spawnRing(setup.store, structure, (hex) => {
      const tile = tileAt(hex);
      return tile ? safeInteger(tile.occupierId) : undefined;
    }).map((tile) => ({ ...tile, biome: tileAt(tile)?.biome }));
  }, [setup.store, structure, tiles]);
  return { center: home ? { col: home.x, row: home.y } : null, ring };
};
