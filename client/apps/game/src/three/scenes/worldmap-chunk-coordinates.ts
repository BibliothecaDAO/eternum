interface ResolveWorldmapChunkCoordinatesInput {
  x: number;
  z: number;
  chunkSize: number;
  hexSize: number;
}

interface WorldmapChunkCoordinates {
  chunkX: number;
  chunkZ: number;
}

interface WorldHexCoordinates {
  col: number;
  row: number;
}

function resolveHexCoordinatesFromWorldPosition(x: number, z: number, hexSize: number): WorldHexCoordinates {
  const normalizedHexSize = Number.isFinite(hexSize) && hexSize > 0 ? hexSize : 1;
  const hexHeight = normalizedHexSize * 2;
  const hexWidth = Math.sqrt(3) * normalizedHexSize;
  const vertDist = hexHeight * 0.75;

  const row = Math.round(z / vertDist);
  const rowOffset = ((row % 2) * Math.sign(row) * hexWidth) / 2;
  const col = Math.round((x + rowOffset) / hexWidth);

  return { col, row };
}

export function resolveWorldmapChunkCoordinates(
  input: ResolveWorldmapChunkCoordinatesInput,
): WorldmapChunkCoordinates {
  const normalizedChunkSize = Number.isFinite(input.chunkSize) && input.chunkSize > 0 ? input.chunkSize : 1;
  const { col, row } = resolveHexCoordinatesFromWorldPosition(input.x, input.z, input.hexSize);

  return {
    chunkX: Math.floor(col / normalizedChunkSize),
    chunkZ: Math.floor(row / normalizedChunkSize),
  };
}
