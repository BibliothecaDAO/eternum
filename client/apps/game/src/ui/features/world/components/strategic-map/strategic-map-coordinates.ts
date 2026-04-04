import { FELT_CENTER } from "@/ui/config";
import type { HexPosition } from "@bibliothecadao/types";

export interface MinimapTile {
  col: number;
  row: number;
  biome?: number;
  occupier_id?: string;
  occupier_type?: number;
  occupier_is_structure?: boolean;
}

export interface CenteredTileEntry {
  tile: MinimapTile;
  centeredCol: number;
  centeredRow: number;
  pixel: { x: number; y: number };
  points: string;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

export interface CenteredIndex {
  byCol: Map<number, CenteredTileEntry[]>;
  byCenteredKey: Map<string, CenteredTileEntry>;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

const STRATEGIC_MAP_HEX_SIZE = 7;
const STRATEGIC_MAP_SQRT3 = Math.sqrt(3);

export const normalizeMinimapTile = (tile: MinimapTile): MinimapTile => ({
  col: Number(tile.col),
  row: Number(tile.row),
  biome: tile.biome !== undefined ? Number(tile.biome) : undefined,
  occupier_id: normalizeEntityId(tile.occupier_id) ?? undefined,
  occupier_type: tile.occupier_type !== undefined ? Number(tile.occupier_type) : undefined,
  occupier_is_structure: Boolean(tile.occupier_is_structure),
});

export const normalizeEntityId = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const raw = typeof value === "string" ? value.trim() : String(value);
  if (!raw) return null;

  try {
    const parsed = BigInt(raw);
    if (parsed === 0n) return null;
    return parsed.toString();
  } catch {
    return raw === "0" ? null : raw;
  }
};

export function contractHexToCenteredHex(hex: HexPosition): HexPosition {
  return {
    col: hex.col - FELT_CENTER(),
    row: hex.row - FELT_CENTER(),
  };
}

export function centeredHexToContractHex(hex: HexPosition): HexPosition {
  return {
    col: hex.col + FELT_CENTER(),
    row: hex.row + FELT_CENTER(),
  };
}

export function offsetToPixel(col: number, row: number): { x: number; y: number } {
  const hexHeight = STRATEGIC_MAP_HEX_SIZE * 2;
  const hexWidth = STRATEGIC_MAP_SQRT3 * STRATEGIC_MAP_HEX_SIZE;
  const vertDist = hexHeight * 0.75;
  const horizDist = hexWidth;
  const rowOffset = ((row % 2) * Math.sign(row) * horizDist) / 2;

  return {
    x: col * horizDist - rowOffset,
    y: row * vertDist,
  };
}

export function pixelToOffset(x: number, y: number): { col: number; row: number } {
  const hexHeight = STRATEGIC_MAP_HEX_SIZE * 2;
  const hexWidth = STRATEGIC_MAP_SQRT3 * STRATEGIC_MAP_HEX_SIZE;
  const vertDist = hexHeight * 0.75;
  const horizDist = hexWidth;
  const row = Math.round(y / vertDist);
  const rowOffset = ((row % 2) * Math.sign(row) * horizDist) / 2;

  return {
    col: Math.round((x + rowOffset) / horizDist),
    row,
  };
}

export function buildCenteredIndex(tiles: MinimapTile[]): CenteredIndex {
  const byCol = new Map<number, CenteredTileEntry[]>();
  const byCenteredKey = new Map<string, CenteredTileEntry>();
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const tile of tiles) {
    const centered = contractHexToCenteredHex(tile);
    const pixel = offsetToPixel(centered.col, centered.row);
    const corners = resolveHexCorners(pixel);
    const points = corners.map((corner) => `${corner.x},${corner.y}`).join(" ");
    const tileBounds = {
      minX: Math.min(...corners.map((corner) => corner.x)),
      maxX: Math.max(...corners.map((corner) => corner.x)),
      minY: Math.min(...corners.map((corner) => corner.y)),
      maxY: Math.max(...corners.map((corner) => corner.y)),
    };

    minX = Math.min(minX, tileBounds.minX);
    maxX = Math.max(maxX, tileBounds.maxX);
    minY = Math.min(minY, tileBounds.minY);
    maxY = Math.max(maxY, tileBounds.maxY);

    const entry: CenteredTileEntry = {
      tile,
      centeredCol: centered.col,
      centeredRow: centered.row,
      pixel,
      points,
      bounds: tileBounds,
    };

    byCenteredKey.set(makeCenteredTileKey(centered.col, centered.row), entry);

    const existing = byCol.get(centered.col);
    if (existing) {
      existing.push(entry);
    } else {
      byCol.set(centered.col, [entry]);
    }
  }

  byCol.forEach((entries, col) => {
    byCol.set(
      col,
      entries.toSorted((left, right) => left.centeredRow - right.centeredRow),
    );
  });

  return {
    byCol,
    byCenteredKey,
    bounds: {
      minX: Number.isFinite(minX) ? minX : 0,
      maxX: Number.isFinite(maxX) ? maxX : 0,
      minY: Number.isFinite(minY) ? minY : 0,
      maxY: Number.isFinite(maxY) ? maxY : 0,
    },
  };
}

export function lookupCenteredEntryForPixel(index: CenteredIndex, x: number, y: number): CenteredTileEntry | null {
  const approx = pixelToOffset(x, y);
  let bestEntry: CenteredTileEntry | null = null;
  let bestDistanceSquared = Number.POSITIVE_INFINITY;

  for (let row = approx.row - 1; row <= approx.row + 1; row += 1) {
    for (let col = approx.col - 1; col <= approx.col + 1; col += 1) {
      const entry = index.byCenteredKey.get(makeCenteredTileKey(col, row));
      if (!entry) {
        continue;
      }

      const dx = entry.pixel.x - x;
      const dy = entry.pixel.y - y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared < bestDistanceSquared) {
        bestDistanceSquared = distanceSquared;
        bestEntry = entry;
      }
    }
  }

  return bestEntry;
}

function resolveHexCorners(center: { x: number; y: number }): Array<{ x: number; y: number }> {
  const corners: Array<{ x: number; y: number }> = [];

  for (let index = 0; index < 6; index += 1) {
    const angle = (Math.PI / 180) * (60 * index - 30);
    corners.push({
      x: center.x + STRATEGIC_MAP_HEX_SIZE * Math.cos(angle),
      y: center.y + STRATEGIC_MAP_HEX_SIZE * Math.sin(angle),
    });
  }

  return corners;
}

function makeCenteredTileKey(col: number, row: number): string {
  return `${col}:${row}`;
}
