import { BiomeType } from "@bibliothecadao/types";
import { createTerrainVerificationRequest } from "@/three/terrain/verification/terrain-verification-fixtures";
import type { TerrainPageRequest } from "@/three/terrain/terrain-types";

export const MAP_CHAPTERS = {
  hexes: [
    "Hover",
    "Selected",
    "Move",
    "Explore",
    "Attackable",
    "Transfer",
    "Build",
    "Deploy",
    "Crate action",
    "Spire travel",
    "Range",
    "Forbidden",
  ],
  routes: ["Selected path", "Hover path", "Moving path", "Preview path", "Order anchor", "Refused anchor"],
  ownership: ["You", "Ally", "Enemy", "Neutral", "Unowned", "Selected holding"],
  strategic: ["Realm", "Village", "Hyperstructure", "Rift", "Crate / bank", "Army T1", "Army T2", "Army T3"],
  sites: ["Camp", "Rift", "Hyperstructure site", "Spire", "Crate", "Fog edge", "Undiscovered", "Revealed"],
} as const;
export type MapChapter = keyof typeof MAP_CHAPTERS;
export const MAP_COLUMNS = ["today", "blitz", "frontier", "eternum"] as const;
export type MapColumn = (typeof MAP_COLUMNS)[number];

export function specimenHex(column: number, index: number) {
  return { col: column * 8 + 2 + (index % 2) * 3, row: 2 + Math.floor(index / 2) * 3 };
}

export function createMapSheetFixture(chapter: MapChapter): TerrainPageRequest {
  const source = createTerrainVerificationRequest("all-biomes");
  const rows = chapter === "hexes" ? 20 : chapter === "sites" || chapter === "strategic" ? 14 : 11;
  const biomes = [BiomeType.Grassland, BiomeType.TemperateDesert, BiomeType.Snow];
  return {
    ...source,
    pageKey: `map-sheet-${chapter}`,
    settlementAnchors: [],
    roadSegments: [],
    halo: [],
    cells: MAP_COLUMNS.flatMap((_, column) =>
      Array.from({ length: 7 * rows }, (_, index) => {
        const localCol = index % 7,
          row = Math.floor(index / 7);
        const biome = biomes[Math.floor(row / 6) % biomes.length];
        const covered =
          chapter === "sites" && ((row >= 8 && row <= 10 && localCol >= 4) || (row >= 10 && localCol <= 3));
        return {
          col: column * 8 + localCol,
          row,
          biome: covered ? null : biome,
          previewBiome: biome,
          explored: !covered,
          occupied: false,
        };
      }),
    ),
  };
}
