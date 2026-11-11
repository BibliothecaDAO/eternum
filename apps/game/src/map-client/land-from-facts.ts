import { BiomeIdToType, BiomeType } from "@bibliothecadao/types";

/** A hex of the map by its normalized column and row: the game's own, less the map's centre. */
export interface Hex {
  col: number;
  row: number;
}

/** An explored tile as the game's spatial projection holds it, its hex normalized. */
export interface ExploredTile extends Hex {
  /** The biome's number, as the chain holds it. */
  biome: number;
  /** Whether a structure stands on it: nothing grows there. */
  occupied: boolean;
}

/** One hex of the land the map draws: explored with its biome, or the next to explore, whose biome nobody knows. */
export interface LandHex extends Hex {
  biome: BiomeType;
  explored: boolean;
}

/** The land round a hex: what the terrain is built from, and every hex the renderer is told of. */
export interface Land {
  /** The explored tiles the terrain is built from. */
  cells: Array<Hex & { biome: BiomeType; occupied: boolean }>;
  /** The explored hexes and, round them, the ring of hexes next to explore. */
  hexes: LandHex[];
}

const keyOf = ({ col, row }: Hex) => `${col},${row}`;

/** The six hexes that touch a hex on the map's lattice, where odd rows sit half a hex west. */
export function neighboursOf({ col, row }: Hex): Hex[] {
  const west = Math.abs(row % 2) === 1 ? -1 : 0;
  return [
    { col: col - 1, row },
    { col: col + 1, row },
    { col: col + west, row: row - 1 },
    { col: col + west + 1, row: row - 1 },
    { col: col + west, row: row + 1 },
    { col: col + west + 1, row: row + 1 },
  ];
}

/**
 * The land within `reach` hexes of `centre`: every explored tile there, and the unexplored hexes that touch one. A
 * tile whose biome the client does not know is left out, loudly.
 */
export function landAround(tiles: readonly ExploredTile[], centre: Hex, reach: number): Land {
  const near = tiles.filter(
    (tile) => Math.abs(tile.col - centre.col) <= reach && Math.abs(tile.row - centre.row) <= reach,
  );
  const explored = new Map<string, LandHex>();
  const cells: Land["cells"] = [];
  for (const tile of near) {
    const biome = BiomeIdToType[tile.biome];
    if (!biome || biome === BiomeType.None) {
      console.error(`The map knows no biome ${tile.biome} for the tile at ${keyOf(tile)}`);
      continue;
    }
    explored.set(keyOf(tile), { col: tile.col, row: tile.row, biome, explored: true });
    cells.push({ col: tile.col, row: tile.row, biome, occupied: tile.occupied });
  }
  const next = new Map<string, LandHex>();
  for (const hex of explored.values()) {
    for (const neighbour of neighboursOf(hex)) {
      const key = keyOf(neighbour);
      if (!explored.has(key)) next.set(key, { ...neighbour, biome: BiomeType.None, explored: false });
    }
  }
  return { cells, hexes: [...explored.values(), ...next.values()] };
}
