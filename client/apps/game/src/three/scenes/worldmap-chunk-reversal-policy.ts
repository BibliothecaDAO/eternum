interface ChunkSwitchPosition {
  x: number;
  z: number;
}

interface ChunkReversalRefreshDecisionInput {
  previousSwitchPosition: ChunkSwitchPosition | null;
  nextSwitchPosition: ChunkSwitchPosition | null;
  previousMovementVector: ChunkSwitchPosition | null;
  minMovementDistance: number;
}

interface ChunkReversalRefreshDecision {
  shouldForceRefresh: boolean;
  nextMovementVector: ChunkSwitchPosition | null;
}

export function resolveChunkReversalRefreshDecision(
  input: ChunkReversalRefreshDecisionInput,
): ChunkReversalRefreshDecision {
  if (!input.previousSwitchPosition || !input.nextSwitchPosition) {
    return {
      shouldForceRefresh: false,
      nextMovementVector: input.nextSwitchPosition
        ? {
            x: input.nextSwitchPosition.x,
            z: input.nextSwitchPosition.z,
          }
        : input.previousMovementVector,
    };
  }

  const dx = input.nextSwitchPosition.x - input.previousSwitchPosition.x;
  const dz = input.nextSwitchPosition.z - input.previousSwitchPosition.z;
  const movementDistance = Math.hypot(dx, dz);
  const minMovementDistance = Math.max(0, input.minMovementDistance);

  if (movementDistance < minMovementDistance) {
    return {
      shouldForceRefresh: false,
      nextMovementVector: input.previousMovementVector,
    };
  }

  const shouldForceRefresh =
    !!input.previousMovementVector && dx * input.previousMovementVector.x + dz * input.previousMovementVector.z < 0;

  return {
    shouldForceRefresh,
    nextMovementVector: { x: dx, z: dz },
  };
}
