interface TerrainCoverageCell {
  biomeKey: string;
  col: number;
  row: number;
}

interface CaptureTerrainContentInput {
  cells: readonly TerrainCoverageCell[];
  getProjectedBiome: (col: number, row: number) => string | undefined;
  isOccupied: (col: number, row: number) => boolean;
  simulateAllExplored: boolean;
}

interface TerrainContentSnapshot {
  cells: Array<TerrainCoverageCell & { occupied: boolean }>;
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
          input.getProjectedBiome(cell.col, cell.row) ?? (input.simulateAllExplored ? cell.biomeKey : "Outline"),
        col: cell.col,
        occupied: input.isOccupied(cell.col, cell.row),
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
