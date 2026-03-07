export interface HexGridRowMetadata {
  globalRow: number;
  baseZ: number;
  rowOffsetValue: number;
}

export function buildHexGridRowMetadata(options: {
  rows: number;
  halfRows: number;
  chunkCenterRow: number;
  vertDist: number;
  horizDist: number;
}): HexGridRowMetadata[] {
  const { rows, halfRows, chunkCenterRow, vertDist, horizDist } = options;
  const metadata: HexGridRowMetadata[] = new Array(rows);

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const rowOffset = rowIndex - halfRows;
    const globalRow = chunkCenterRow + rowOffset;
    metadata[rowIndex] = {
      globalRow,
      baseZ: globalRow * vertDist,
      rowOffsetValue: ((globalRow % 2) * Math.sign(globalRow) * horizDist) / 2,
    };
  }

  return metadata;
}
