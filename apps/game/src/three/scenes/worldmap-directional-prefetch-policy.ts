export interface DirectionalPrefetchInput {
  forwardChunkKey: string;
  chunkSize: number;
  forwardDepthStrides: number;
  sideRadiusStrides: number;
  movementAxis: "x" | "z";
  movementSign: -1 | 1;
}

function parseChunkKey(chunkKey: string): { row: number; col: number } {
  const segments = chunkKey.split(",");
  if (segments.length !== 2) {
    throw new Error(`Invalid chunk key: ${chunkKey}`);
  }

  const rowToken = segments[0].trim();
  const colToken = segments[1].trim();
  if (rowToken.length === 0 || colToken.length === 0) {
    throw new Error(`Invalid chunk key: ${chunkKey}`);
  }

  const row = Number(rowToken);
  const col = Number(colToken);
  if (!Number.isFinite(row) || !Number.isFinite(col)) {
    throw new Error(`Invalid chunk key: ${chunkKey}`);
  }

  return { row, col };
}

export function deriveDirectionalPrefetchChunkKeys(input: DirectionalPrefetchInput): string[] {
  const { row: forwardRow, col: forwardCol } = parseChunkKey(input.forwardChunkKey);
  const chunkKeys: string[] = [];

  for (let forwardStride = 0; forwardStride <= input.forwardDepthStrides; forwardStride += 1) {
    for (let sideStride = -input.sideRadiusStrides; sideStride <= input.sideRadiusStrides; sideStride += 1) {
      const row =
        input.movementAxis === "z"
          ? forwardRow + forwardStride * input.movementSign * input.chunkSize
          : forwardRow + sideStride * input.chunkSize;
      const col =
        input.movementAxis === "x"
          ? forwardCol + forwardStride * input.movementSign * input.chunkSize
          : forwardCol + sideStride * input.chunkSize;
      chunkKeys.push(`${row},${col}`);
    }
  }

  return chunkKeys;
}
