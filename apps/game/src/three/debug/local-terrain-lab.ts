import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType } from "@bibliothecadao/types";
import { createHexceptionTerrainRequest, getLocalHexDisk } from "@/three/scenes/hexception-terrain";

export function createLocalTerrainLabRequest(radius: number) {
  const buildable = new Set(getLocalHexDisk({ col: 0, row: 0 }, radius).map((cell) => `${cell.col}:${cell.row}`));
  const cells = getLocalHexDisk({ col: 0, row: 0 }, radius + 2).map(({ col, row }) => ({
    col,
    row,
    biome: BiomeType.Grassland,
    previewBiome: BiomeType.Grassland,
    explored: true,
    occupied: buildable.has(`${col}:${row}`),
  }));
  return createHexceptionTerrainRequest(cells, NEUTRAL_BIOME_CLIMATE, `lab:local:${radius}`);
}
