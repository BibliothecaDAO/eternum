import { getRenderBounds } from "../utils/chunk-geometry";

interface ChunkRenderSize {
  width: number;
  height: number;
}

interface ChunkBounds {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}

function parseChunkKey(chunkKey: string): { startRow: number; startCol: number } {
  const segments = chunkKey.split(",");
  if (segments.length !== 2) {
    throw new Error(`Invalid chunk key: ${chunkKey}`);
  }

  const rowToken = segments[0].trim();
  const colToken = segments[1].trim();
  if (rowToken.length === 0 || colToken.length === 0) {
    throw new Error(`Invalid chunk key: ${chunkKey}`);
  }

  const startRow = Number(rowToken);
  const startCol = Number(colToken);
  if (!Number.isFinite(startRow) || !Number.isFinite(startCol)) {
    throw new Error(`Invalid chunk key: ${chunkKey}`);
  }

  return { startRow, startCol };
}

export function getRenderAreaKeyForChunk(chunkKey: string, chunkSize: number, superAreaStrides: number): string {
  const { startRow, startCol } = parseChunkKey(chunkKey);
  const chunkRowIdx = startRow / chunkSize;
  const chunkColIdx = startCol / chunkSize;
  const areaRowIdx = Math.floor(chunkRowIdx / superAreaStrides) * superAreaStrides;
  const areaColIdx = Math.floor(chunkColIdx / superAreaStrides) * superAreaStrides;

  return `${areaRowIdx * chunkSize},${areaColIdx * chunkSize}`;
}

export function getRenderFetchBoundsForChunk(
  chunkKey: string,
  renderSize: ChunkRenderSize,
  chunkSize: number,
): ChunkBounds {
  const { startRow, startCol } = parseChunkKey(chunkKey);
  return getRenderBounds(startRow, startCol, renderSize, chunkSize);
}

export function getRenderFetchBoundsForArea(
  areaKey: string,
  renderSize: ChunkRenderSize,
  chunkSize: number,
  superAreaStrides: number,
): ChunkBounds {
  const { startRow: areaStartRow, startCol: areaStartCol } = parseChunkKey(areaKey);
  const firstBounds = getRenderBounds(areaStartRow, areaStartCol, renderSize, chunkSize);
  const lastChunkStartRow = areaStartRow + (superAreaStrides - 1) * chunkSize;
  const lastChunkStartCol = areaStartCol + (superAreaStrides - 1) * chunkSize;
  const lastBounds = getRenderBounds(lastChunkStartRow, lastChunkStartCol, renderSize, chunkSize);

  return {
    minCol: firstBounds.minCol,
    maxCol: lastBounds.maxCol,
    minRow: firstBounds.minRow,
    maxRow: lastBounds.maxRow,
  };
}
