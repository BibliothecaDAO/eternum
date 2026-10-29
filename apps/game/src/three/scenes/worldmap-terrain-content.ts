import { resolveWorldmapVisualTerrainPageKeyForHex } from "./worldmap-terrain-presentation-runtime";
/** The biome a terrain cell draws while its tile is unexplored: its outline. */
export const UNEXPLORED_TERRAIN_BIOME = "Outline";

interface TerrainCoverageCell {
  biomeKey: string;
  col: number;
  row: number;
}

/** What the current facts say of one cell: its biome once explored, whether terrain levels a pad under it, its surface. */
export interface TerrainCellFacts {
  projectedBiome: string | undefined;
  occupied: boolean;
  surfacePresentation: "ethereal" | undefined;
}

interface CaptureTerrainContentInput {
  cells: readonly TerrainCoverageCell[];
  /** One read per cell: each lookup into the projection costs a key build, and a page has thousands of cells. */
  readCell: (col: number, row: number) => TerrainCellFacts;
  simulateAllExplored: boolean;
}

interface TerrainContentSnapshot {
  cells: Array<TerrainCoverageCell & { occupied: boolean; surfacePresentation?: "ethereal" }>;
  commitMode: "atomic" | "ambient";
  revision: number;
}

/** Tracks presentation completion, while every capture reads current projection-derived facts. */
export class WorldmapTerrainContent {
  private revision = 0;
  private presentedRevision = 0;

  invalidate(): void {
    this.revision += 1;
  }

  capture(input: CaptureTerrainContentInput): TerrainContentSnapshot {
    return {
      revision: this.revision,
      commitMode: this.presentedRevision < this.revision ? "atomic" : "ambient",
      cells: input.cells.map((cell) => {
        const facts = input.readCell(cell.col, cell.row);
        return {
          biomeKey: facts.projectedBiome ?? (input.simulateAllExplored ? cell.biomeKey : UNEXPLORED_TERRAIN_BIOME),
          col: cell.col,
          occupied: facts.occupied,
          surfacePresentation: facts.surfacePresentation,
          row: cell.row,
        };
      }),
    };
  }

  presented(snapshot: TerrainContentSnapshot): void {
    this.presentedRevision = Math.max(this.presentedRevision, snapshot.revision);
  }

  clear(): void {
    this.revision += 1;
    this.presentedRevision = this.revision;
  }
}

/** A terrain page as it was presented: its key, and the page size and origin that key its cells. */
interface PresentedPage {
  key: string;
  size: { width: number; height: number };
  origin: { col: number; row: number };
}

/**
 * The awaited tiles one presented terrain page draws, taken from `awaiting` (keyed "<col>,<row>" in contract
 * coordinates; the cells are centred on `center`): a cell on another page, or still drawing the unexplored outline,
 * does not show its tile yet.
 */
export function takeShownTiles<T>(
  awaiting: Map<string, T>,
  cells: readonly TerrainCoverageCell[],
  center: number,
  page: PresentedPage,
): Array<[string, T]> {
  const shown: Array<[string, T]> = [];
  for (const cell of cells) {
    if (awaiting.size === 0) break;
    if (cell.biomeKey === UNEXPLORED_TERRAIN_BIOME) continue;
    if (resolveWorldmapVisualTerrainPageKeyForHex(cell, page.size, page.origin).pageKey !== page.key) continue;
    const key = `${cell.col + center},${cell.row + center}`;
    const waiting = awaiting.get(key);
    if (waiting === undefined) continue;
    awaiting.delete(key);
    shown.push([key, waiting]);
  }
  return shown;
}
