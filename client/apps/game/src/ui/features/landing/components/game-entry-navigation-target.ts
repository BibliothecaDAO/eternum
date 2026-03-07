export interface GameEntryNavigationTarget {
  structureEntityId: number;
  worldMapPosition: { col: number; row: number };
  url: string;
}

interface ResolveGameEntryNavigationTargetInput {
  isSpectateMode: boolean;
  structureEntityId: number;
  worldMapReturnPosition?: { col: number; row: number } | null;
  resolvedStructurePosition?: { col: number; row: number } | null;
}

const DEFAULT_TARGET = { col: 0, row: 0 } as const;
const MAX_SAFE_WORLDMAP_ABS_COORD = 500_000;

export function isSafeWorldMapPosition(
  position?: { col: number; row: number } | null,
): position is { col: number; row: number } {
  if (!position) {
    return false;
  }

  if (!Number.isFinite(position.col) || !Number.isFinite(position.row)) {
    return false;
  }

  return Math.abs(position.col) <= MAX_SAFE_WORLDMAP_ABS_COORD && Math.abs(position.row) <= MAX_SAFE_WORLDMAP_ABS_COORD;
}

export function resolveGameEntryNavigationTarget(
  input: ResolveGameEntryNavigationTargetInput,
): GameEntryNavigationTarget {
  const resolvedStructurePosition = isSafeWorldMapPosition(input.resolvedStructurePosition)
    ? {
        col: input.resolvedStructurePosition.col,
        row: input.resolvedStructurePosition.row,
      }
    : null;
  const worldMapReturnPosition = isSafeWorldMapPosition(input.worldMapReturnPosition)
    ? {
        col: input.worldMapReturnPosition.col,
        row: input.worldMapReturnPosition.row,
      }
    : null;
  const worldMapPosition =
    input.isSpectateMode && resolvedStructurePosition
      ? resolvedStructurePosition
      : input.isSpectateMode && worldMapReturnPosition
      ? worldMapReturnPosition
      : DEFAULT_TARGET;

  const structureEntityId = input.isSpectateMode ? Number(input.structureEntityId || 0) : 0;
  const url = input.isSpectateMode
    ? `/play/map?col=${worldMapPosition.col}&row=${worldMapPosition.row}&spectate=true`
    : `/play/hex?col=0&row=0`;

  return {
    structureEntityId,
    worldMapPosition,
    url,
  };
}
