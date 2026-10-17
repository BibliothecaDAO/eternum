import { terrainHexToWorld } from "@/three/terrain/terrain-coordinates";
import { ENDGAME_SEQUENCE } from "./sequence";
export interface EndgameHex {
  col: number;
  row: number;
}
interface EndgameTile extends EndgameHex {
  occupied: boolean;
}
interface EndgameSource extends EndgameHex {
  materialise: boolean;
}
export interface EndgamePlan {
  sources: EndgameSource[];
  anchor: EndgameHex;
  bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number };
  sparedHex: EndgameHex | null;
  maximumReach: number;
}

/** Two sources keep the approved burst budget. Every source is a known tile or an already-rendered spire. */
export function planGameEnd(
  tiles: readonly EndgameTile[],
  spires: readonly EndgameHex[],
  sparedHex: EndgameHex | null,
): EndgamePlan | null {
  const observed = tiles.length ? tiles : [...spires, ...(sparedHex ? [sparedHex] : [])];
  if (!observed.length) return null;
  const bounds = { minCol: Infinity, maxCol: -Infinity, minRow: Infinity, maxRow: -Infinity };
  for (const tile of observed) {
    bounds.minCol = Math.min(bounds.minCol, tile.col);
    bounds.maxCol = Math.max(bounds.maxCol, tile.col);
    bounds.minRow = Math.min(bounds.minRow, tile.row);
    bounds.maxRow = Math.max(bounds.maxRow, tile.row);
  }
  const col = (bounds.minCol + bounds.maxCol) / 2,
    row = (bounds.minRow + bounds.maxRow) / 2;
  const nearest = (a: EndgameHex, b: EndgameHex) =>
    (a.col - col) ** 2 + (a.row - row) ** 2 - (b.col - col) ** 2 - (b.row - row) ** 2 || a.row - b.row || a.col - b.col;
  const anchor = [...observed].sort(nearest)[0];
  const known = [...new Map(spires.map((hex) => [hex.col + ":" + hex.row, hex])).values()].sort(nearest);
  const sources: EndgameSource[] = known.slice(0, 2).map((p) => ({ ...p, materialise: false }));
  if (!sources.length) {
    const available = tiles.filter(
      (tile) => !tile.occupied && !(tile.col === sparedHex?.col && tile.row === sparedHex.row),
    );
    for (const direction of [-1, 1]) {
      const targetCol = col + (direction * (bounds.maxCol - bounds.minCol)) / 4;
      const targetRow = row + (direction * (bounds.maxRow - bounds.minRow)) / 8;
      let best: EndgameTile | undefined;
      let distance = Infinity;
      for (const tile of available) {
        if (sources.some((source) => source.col === tile.col && source.row === tile.row)) continue;
        const next = (tile.col - targetCol) ** 2 + (tile.row - targetRow) ** 2;
        if (
          next < distance ||
          (next === distance && best && (tile.row < best.row || (tile.row === best.row && tile.col < best.col)))
        ) {
          best = tile;
          distance = next;
        }
      }
      if (best) sources.push({ col: best.col, row: best.row, materialise: true });
    }
  }
  const origins = (sources.length ? sources : [anchor]).map((p) => terrainHexToWorld(p.col, p.row));
  let maximumReach = 0;
  for (const tile of observed) {
    const p = terrainHexToWorld(tile.col, tile.row);
    maximumReach = Math.max(maximumReach, Math.min(...origins.map((o) => Math.hypot(p.x - o.x, p.z - o.z))));
  }
  maximumReach += ENDGAME_SEQUENCE.width;
  return { sources, anchor: { col: anchor.col, row: anchor.row }, bounds, sparedHex, maximumReach };
}
