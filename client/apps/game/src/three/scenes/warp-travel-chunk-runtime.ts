export interface WarpTravelChunkCoordinatesInput {
  x: number;
  z: number;
  chunkSize: number;
  hexSize: number;
}

export interface WarpTravelChunkCoordinates {
  chunkX: number;
  chunkZ: number;
  startCol: number;
  startRow: number;
  chunkKey: string;
}

export interface WarpTravelVisibleChunkDecisionInput {
  isSwitchedOff: boolean;
  focusPoint: {
    x: number;
    z: number;
  };
  chunkSize: number;
  hexSize: number;
  currentChunk: string;
  force: boolean;
  reason: "default" | "shortcut";
  shouldDelayChunkSwitch: boolean;
}

export interface WarpTravelVisibleChunkDecision {
  action: "noop" | "switch_chunk" | "refresh_current_chunk";
  chunkChanged: boolean;
  chunkKey: string | null;
  startCol: number | null;
  startRow: number | null;
  shouldPrefetch: boolean;
}

export function resolveWarpTravelChunkCoordinates(input: WarpTravelChunkCoordinatesInput): WarpTravelChunkCoordinates {
  const chunkX = Math.floor(input.x / (input.chunkSize * input.hexSize * Math.sqrt(3)));
  const chunkZ = Math.floor(input.z / (input.chunkSize * input.hexSize * 1.5));
  const startCol = chunkX * input.chunkSize;
  const startRow = chunkZ * input.chunkSize;

  return {
    chunkX,
    chunkZ,
    startCol,
    startRow,
    chunkKey: `${startRow},${startCol}`,
  };
}

export function resolveWarpTravelVisibleChunkDecision(
  input: WarpTravelVisibleChunkDecisionInput,
): WarpTravelVisibleChunkDecision {
  if (input.isSwitchedOff) {
    return {
      action: "noop",
      chunkChanged: false,
      chunkKey: null,
      startCol: null,
      startRow: null,
      shouldPrefetch: false,
    };
  }

  const coordinates = resolveWarpTravelChunkCoordinates({
    x: input.focusPoint.x,
    z: input.focusPoint.z,
    chunkSize: input.chunkSize,
    hexSize: input.hexSize,
  });
  const chunkChanged = input.currentChunk !== coordinates.chunkKey;
  const isShortcutNavigation = input.reason === "shortcut";

  if (!input.force && chunkChanged && !isShortcutNavigation && input.shouldDelayChunkSwitch) {
    return {
      action: "noop",
      chunkChanged,
      chunkKey: coordinates.chunkKey,
      startCol: coordinates.startCol,
      startRow: coordinates.startRow,
      shouldPrefetch: false,
    };
  }

  if (chunkChanged) {
    return {
      action: "switch_chunk",
      chunkChanged,
      chunkKey: coordinates.chunkKey,
      startCol: coordinates.startCol,
      startRow: coordinates.startRow,
      shouldPrefetch: true,
    };
  }

  if (input.force) {
    return {
      action: "refresh_current_chunk",
      chunkChanged,
      chunkKey: coordinates.chunkKey,
      startCol: coordinates.startCol,
      startRow: coordinates.startRow,
      shouldPrefetch: true,
    };
  }

  return {
    action: "noop",
    chunkChanged,
    chunkKey: coordinates.chunkKey,
    startCol: coordinates.startCol,
    startRow: coordinates.startRow,
    shouldPrefetch: true,
  };
}
