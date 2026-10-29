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
          biomeKey: facts.projectedBiome ?? (input.simulateAllExplored ? cell.biomeKey : "Outline"),
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
