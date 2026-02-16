const EXPLORER_OCCUPIER_MIN = 15;
const EXPLORER_OCCUPIER_MAX = 32;

type Bounds = {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
};

type TileLike = {
  occupier_id?: number | bigint | string | null;
  occupier_type?: number | null;
};

const normalizeEntityId = (value: TileLike["occupier_id"]): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "bigint" && value > 0n) {
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
  }

  if (typeof value === "string" && value.length > 0) {
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
  }

  return null;
};

export const collectMissingExplorerIdsInBounds = ({
  bounds,
  readTile,
  hasExplorer,
}: {
  bounds: Bounds;
  readTile: (col: number, row: number) => TileLike | undefined;
  hasExplorer: (entityId: number) => boolean;
}): number[] => {
  const missingExplorerIds = new Set<number>();

  for (let col = bounds.minCol; col <= bounds.maxCol; col += 1) {
    for (let row = bounds.minRow; row <= bounds.maxRow; row += 1) {
      const tile = readTile(col, row);
      if (!tile) continue;

      const occupierId = normalizeEntityId(tile.occupier_id);
      if (!occupierId) continue;

      const occupierType = Number(tile.occupier_type ?? 0);
      if (occupierType < EXPLORER_OCCUPIER_MIN || occupierType > EXPLORER_OCCUPIER_MAX) continue;

      if (!hasExplorer(occupierId)) {
        missingExplorerIds.add(occupierId);
      }
    }
  }

  return [...missingExplorerIds];
};
