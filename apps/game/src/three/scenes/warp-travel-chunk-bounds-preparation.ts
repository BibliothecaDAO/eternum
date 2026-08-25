interface PrepareWarpTravelChunkBoundsInput<TBounds> {
  targetChunkKey: string;
  startRow: number;
  startCol: number;
  hasFiniteOldChunkCoordinates: boolean;
  oldChunkCoordinates: [number, number] | null;
  computeChunkBounds: (startRow: number, startCol: number) => TBounds;
  registerChunk: (chunkKey: string, bounds: TBounds) => void;
  combineChunkBounds: (previousBounds: TBounds, targetBounds: TBounds) => TBounds;
  applySceneChunkBounds: (bounds: TBounds) => void;
}

export function prepareWarpTravelChunkBounds<TBounds>(input: PrepareWarpTravelChunkBoundsInput<TBounds>): TBounds {
  const targetChunkBounds = input.computeChunkBounds(input.startRow, input.startCol);
  input.registerChunk(input.targetChunkKey, targetChunkBounds);

  if (input.hasFiniteOldChunkCoordinates && input.oldChunkCoordinates) {
    const previousChunkBounds = input.computeChunkBounds(input.oldChunkCoordinates[0], input.oldChunkCoordinates[1]);
    input.applySceneChunkBounds(input.combineChunkBounds(previousChunkBounds, targetChunkBounds));
    return targetChunkBounds;
  }

  input.applySceneChunkBounds(targetChunkBounds);
  return targetChunkBounds;
}
