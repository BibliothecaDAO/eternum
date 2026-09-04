/**
 * Snapshots a region of the exploredTiles map so that multi-frame terrain
 * processing reads a consistent view, immune to concurrent mutations.
 */

interface SnapshotRegion {
  centerCol: number;
  centerRow: number;
  halfCols: number;
  halfRows: number;
}

/** Opaque snapshot type — a frozen copy of biome data for a rectangular region. */
type ExploredTilesSnapshot = ReadonlyMap<number, ReadonlyMap<number, unknown>>;

export function snapshotExploredTilesRegion<TBiome>(
  exploredTiles: Map<number, Map<number, TBiome>>,
  region: SnapshotRegion,
): ExploredTilesSnapshot {
  const { centerCol, centerRow, halfCols, halfRows } = region;
  const minCol = centerCol - halfCols;
  const maxCol = centerCol + halfCols;
  const minRow = centerRow - halfRows;
  const maxRow = centerRow + halfRows;

  const snapshot = new Map<number, Map<number, TBiome>>();

  for (const [col, rowMap] of exploredTiles) {
    if (col < minCol || col > maxCol) continue;

    const rowSnapshot = new Map<number, TBiome>();
    for (const [row, biome] of rowMap) {
      if (row < minRow || row > maxRow) continue;
      rowSnapshot.set(row, biome);
    }

    if (rowSnapshot.size > 0) {
      snapshot.set(col, rowSnapshot);
    }
  }

  return snapshot;
}

export function lookupSnapshotBiome<TBiome = unknown>(
  snapshot: ExploredTilesSnapshot,
  col: number,
  row: number,
): TBiome | undefined {
  return (snapshot as Map<number, Map<number, TBiome>>).get(col)?.get(row);
}
