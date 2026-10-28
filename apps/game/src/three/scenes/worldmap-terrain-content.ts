/** The biome a terrain cell draws while its tile is unexplored: its outline. */
export const UNEXPLORED_TERRAIN_BIOME = "Outline";

interface TerrainCoverageCell {
  biomeKey: string;
  col: number;
  row: number;
}

interface CaptureTerrainContentInput {
  cells: readonly TerrainCoverageCell[];
  getProjectedBiome: (col: number, row: number) => string | undefined;
  isOccupied: (col: number, row: number) => boolean;
  getSurfacePresentation: (col: number, row: number) => "ethereal" | undefined;
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
      cells: input.cells.map((cell) => ({
        biomeKey:
          input.getProjectedBiome(cell.col, cell.row) ??
          (input.simulateAllExplored ? cell.biomeKey : UNEXPLORED_TERRAIN_BIOME),
        col: cell.col,
        occupied: input.isOccupied(cell.col, cell.row),
        surfacePresentation: input.getSurfacePresentation(cell.col, cell.row),
        row: cell.row,
      })),
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

/**
 * The awaited tiles a presented terrain draws, taken from `awaiting` (keyed "<col>,<row>" in contract coordinates; the
 * cells are centred on `center`): a cell still drawing the unexplored outline does not show its tile yet.
 */
export function takeShownTiles<T>(
  awaiting: Map<string, T>,
  cells: readonly TerrainCoverageCell[],
  center: number,
): Array<[string, T]> {
  const shown: Array<[string, T]> = [];
  for (const cell of cells) {
    if (awaiting.size === 0) break;
    if (cell.biomeKey === UNEXPLORED_TERRAIN_BIOME) continue;
    const key = `${cell.col + center},${cell.row + center}`;
    const waiting = awaiting.get(key);
    if (waiting === undefined) continue;
    awaiting.delete(key);
    shown.push([key, waiting]);
  }
  return shown;
}
