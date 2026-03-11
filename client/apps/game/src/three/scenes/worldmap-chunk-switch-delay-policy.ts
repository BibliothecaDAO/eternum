interface ChunkSwitchPosition {
  x: number;
  z: number;
}

interface ChunkSwitchDelayInput {
  hasChunkSwitchAnchor: boolean;
  lastChunkSwitchPosition: ChunkSwitchPosition | undefined;
  cameraPosition: ChunkSwitchPosition;
  chunkSize: number;
  hexSize: number;
  chunkSwitchPadding: number;
}

export function shouldDelayWorldmapChunkSwitch(input: ChunkSwitchDelayInput): boolean {
  if (!input.hasChunkSwitchAnchor || !input.lastChunkSwitchPosition) {
    return false;
  }

  const chunkWorldWidth = input.chunkSize * input.hexSize * Math.sqrt(3);
  const chunkWorldDepth = input.chunkSize * input.hexSize * 1.5;
  const dx = Math.abs(input.cameraPosition.x - input.lastChunkSwitchPosition.x);
  const dz = Math.abs(input.cameraPosition.z - input.lastChunkSwitchPosition.z);

  return dx < chunkWorldWidth * input.chunkSwitchPadding && dz < chunkWorldDepth * input.chunkSwitchPadding;
}
