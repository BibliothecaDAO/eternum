interface MemorySnapshot {
  heapUsedMB: number;
}

interface ChunkSwitchPosition {
  x: number;
  z: number;
}

interface WorldmapChunkSwitchAnchorState {
  hasChunkSwitchAnchor: boolean;
  movementVector: ChunkSwitchPosition | null;
  switchPosition: ChunkSwitchPosition | undefined;
}

export function recordWorldmapChunkMemoryDelta(input: {
  postChunkStats?: MemorySnapshot;
  preChunkStats?: MemorySnapshot;
}): number | undefined {
  if (!input.preChunkStats || !input.postChunkStats) {
    return undefined;
  }

  return input.postChunkStats.heapUsedMB - input.preChunkStats.heapUsedMB;
}

export function resolveWorldmapChunkSwitchAnchorState(input: {
  nextMovementVector: ChunkSwitchPosition | null;
  previousAnchorState: WorldmapChunkSwitchAnchorState;
  switchPosition: ChunkSwitchPosition | undefined;
}): WorldmapChunkSwitchAnchorState {
  if (!input.switchPosition) {
    return input.previousAnchorState;
  }

  return {
    hasChunkSwitchAnchor: true,
    movementVector: input.nextMovementVector ?? input.previousAnchorState.movementVector,
    switchPosition: input.switchPosition,
  };
}
