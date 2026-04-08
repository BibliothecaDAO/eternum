import { resolveChunkReversalRefreshDecision } from "./worldmap-chunk-reversal-policy";

type ChunkSwitchPosition = {
  x: number;
  z: number;
};

interface PrepareWorldmapChunkSwitchRuntimeInput {
  chunkKey: string;
  currentChunk?: string;
  force: boolean;
  getSurroundingChunkKeys: (startRow: number, startCol: number) => string[];
  invalidateTerrainCaches: (
    chunkKey: string,
    options: { includeSurroundingChunks: string[]; invalidateFetchAreas: true },
  ) => void;
  lastChunkSwitchMovement: ChunkSwitchPosition | null;
  lastChunkSwitchPosition: ChunkSwitchPosition | null;
  pinnedChunkKeys: Set<string>;
  prepareBounds: (input: {
    hasFiniteOldChunkCoordinates: boolean;
    oldChunkCoordinates: [number, number] | null;
    startCol: number;
    startRow: number;
    targetChunkKey: string;
  }) => void;
  removeCachedMatricesForChunk: (startRow: number, startCol: number) => void;
  startCol: number;
  startRow: number;
  switchPosition: ChunkSwitchPosition | null;
}

interface PrepareWorldmapChunkSwitchRuntimeResult {
  effectiveForce: boolean;
  hasFiniteOldChunkCoordinates: boolean;
  oldChunk: string;
  oldChunkCoordinates: [number, number] | null;
  previousPinnedChunks: string[];
  reversalRefreshDecision: ReturnType<typeof resolveChunkReversalRefreshDecision>;
  surroundingChunks: string[];
}

export function prepareWorldmapChunkSwitchRuntime(
  input: PrepareWorldmapChunkSwitchRuntimeInput,
): PrepareWorldmapChunkSwitchRuntimeResult {
  const oldChunk = input.currentChunk ?? "null";
  const reversalRefreshDecision = resolveChunkReversalRefreshDecision({
    previousSwitchPosition: input.lastChunkSwitchPosition,
    nextSwitchPosition: input.switchPosition,
    previousMovementVector: input.lastChunkSwitchMovement,
    minMovementDistance: 0.001,
  });
  const effectiveForce = input.force || reversalRefreshDecision.shouldForceRefresh;
  const previousPinnedChunks = Array.from(input.pinnedChunkKeys);
  const parsedOldChunkCoordinates = oldChunk !== "null" ? oldChunk.split(",").map(Number) : null;
  const hasFiniteOldChunkCoordinates =
    parsedOldChunkCoordinates !== null &&
    Number.isFinite(parsedOldChunkCoordinates[0]) &&
    Number.isFinite(parsedOldChunkCoordinates[1]);
  const oldChunkCoordinates =
    hasFiniteOldChunkCoordinates && parsedOldChunkCoordinates !== null
      ? ([parsedOldChunkCoordinates[0], parsedOldChunkCoordinates[1]] as [number, number])
      : null;

  input.prepareBounds({
    hasFiniteOldChunkCoordinates,
    oldChunkCoordinates,
    startCol: input.startCol,
    startRow: input.startRow,
    targetChunkKey: input.chunkKey,
  });

  const surroundingChunks = input.getSurroundingChunkKeys(input.startRow, input.startCol);
  if (reversalRefreshDecision.shouldForceRefresh) {
    input.invalidateTerrainCaches(input.chunkKey, {
      includeSurroundingChunks: surroundingChunks,
      invalidateFetchAreas: true,
    });
  } else if (effectiveForce) {
    input.removeCachedMatricesForChunk(input.startRow, input.startCol);
  }

  return {
    effectiveForce,
    hasFiniteOldChunkCoordinates,
    oldChunk,
    oldChunkCoordinates,
    previousPinnedChunks,
    reversalRefreshDecision,
    surroundingChunks,
  };
}
