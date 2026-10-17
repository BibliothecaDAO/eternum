import { BiomeType, StructureType } from "@bibliothecadao/types";
import { createTerrainVerificationRequest } from "@/three/terrain/verification/terrain-verification-fixtures";
import type { TerrainPageRequest } from "@/three/terrain/terrain-types";
import type { EndgameSettings } from "./sequence";

export function createEndgameFixture(settings: EndgameSettings) {
  const columns = settings.busy ? 36 : 20;
  const rows = settings.busy ? 28 : 16;
  const realm = { col: Math.floor(columns / 2), row: Math.floor(rows / 2) };
  const spires = [
    { col: realm.col - 5, row: realm.row - 2 },
    { col: realm.col + 5, row: realm.row + (settings.busy ? 2 : 1) },
  ];
  const realms = settings.busy
    ? Array.from({ length: 24 }, (_, i) => ({ col: 3 + (i % 6) * 5, row: 3 + Math.floor(i / 6) * 6 }))
    : [
        { col: 4, row: 4 },
        { col: 15, row: 4 },
        { col: 5, row: 12 },
        { col: 15, row: 12 },
      ];
  realms.push(realm);
  const occupied = new Set([...realms, ...spires].map((p) => `${p.col}:${p.row}`));
  const biomes = [
    BiomeType.Grassland,
    BiomeType.TemperateDeciduousForest,
    BiomeType.Shrubland,
    BiomeType.TemperateDesert,
    BiomeType.Taiga,
    BiomeType.Snow,
    BiomeType.Scorched,
    BiomeType.TropicalSeasonalForest,
  ];
  const source = createTerrainVerificationRequest("all-biomes");
  const request: TerrainPageRequest = {
    ...source,
    pageKey: "endgame-lab",
    subdivisions: 3,
    cells: Array.from({ length: columns * rows }, (_, i) => {
      const col = i % columns,
        row = Math.floor(i / columns);
      const key = `${col}:${row}`;
      const realmCell = realms.some((p) => p.col === col && p.row === row);
      const biome = realmCell
        ? BiomeType.Grassland
        : biomes[(Math.floor(col / 5) + Math.floor(row / 4) * 2) % biomes.length];
      return {
        col,
        row,
        biome,
        previewBiome: biome,
        explored: true,
        occupied: occupied.has(key),
      };
    }),
    settlementAnchors: realms.map((p, i) => ({
      ...p,
      level: 1,
      structureId: `endgame:${i}`,
      structureType: StructureType.Realm,
    })),
  };
  return { request, spires, realms, realm, columns, rows };
}
