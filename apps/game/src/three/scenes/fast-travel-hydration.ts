export interface FastTravelHexCoords {
  col: number;
  row: number;
}

export interface FastTravelArmyHydrationInput {
  entityId: string;
  hexCoords: FastTravelHexCoords;
  ownerName: string;
}

export interface FastTravelSpireHydrationInput {
  entityId: string;
  worldHexCoords: FastTravelHexCoords;
  travelHexCoords: FastTravelHexCoords;
  label: string;
}

export interface FastTravelHexEntityReference {
  entityId: string;
  kind: "army" | "spire";
}

export interface FastTravelChunkHydrationResult {
  chunkKey: string;
  armies: FastTravelArmyHydrationInput[];
  spireAnchors: FastTravelSpireHydrationInput[];
  visibleHexWindow: FastTravelHexCoords[];
  hexEntityLookup: Map<string, FastTravelHexEntityReference[]>;
  managerPayload: {
    armyEntities: FastTravelArmyHydrationInput[];
    spireAnchors: FastTravelSpireHydrationInput[];
  };
}

function isHexInWindow(
  hex: FastTravelHexCoords,
  bounds: { startCol: number; startRow: number; width: number; height: number },
): boolean {
  return (
    hex.col >= bounds.startCol &&
    hex.col < bounds.startCol + bounds.width &&
    hex.row >= bounds.startRow &&
    hex.row < bounds.startRow + bounds.height
  );
}

function toHexKey(hex: FastTravelHexCoords): string {
  return `${hex.col},${hex.row}`;
}

function buildVisibleHexWindow(bounds: {
  startCol: number;
  startRow: number;
  width: number;
  height: number;
}): FastTravelHexCoords[] {
  return Array.from({ length: bounds.height }, (_, rowOffset) =>
    Array.from({ length: bounds.width }, (_, colOffset) => ({
      col: bounds.startCol + colOffset,
      row: bounds.startRow + rowOffset,
    })),
  ).flat();
}

export function hydrateFastTravelChunkState(input: {
  chunkKey: string;
  startCol: number;
  startRow: number;
  width: number;
  height: number;
  armies: FastTravelArmyHydrationInput[];
  spires: FastTravelSpireHydrationInput[];
}): FastTravelChunkHydrationResult {
  const bounds = {
    startCol: input.startCol,
    startRow: input.startRow,
    width: input.width,
    height: input.height,
  };

  const armies = input.armies.filter((army) => isHexInWindow(army.hexCoords, bounds));
  const spireAnchors = input.spires.filter((spire) => isHexInWindow(spire.travelHexCoords, bounds));
  const hexEntityLookup = new Map<string, FastTravelHexEntityReference[]>();

  armies.forEach((army) => {
    const key = toHexKey(army.hexCoords);
    const existing = hexEntityLookup.get(key) ?? [];
    existing.push({
      entityId: army.entityId,
      kind: "army",
    });
    hexEntityLookup.set(key, existing);
  });

  spireAnchors.forEach((spire) => {
    const key = toHexKey(spire.travelHexCoords);
    const existing = hexEntityLookup.get(key) ?? [];
    existing.push({
      entityId: spire.entityId,
      kind: "spire",
    });
    hexEntityLookup.set(key, existing);
  });

  return {
    chunkKey: input.chunkKey,
    armies,
    spireAnchors,
    visibleHexWindow: buildVisibleHexWindow(bounds),
    hexEntityLookup,
    managerPayload: {
      armyEntities: armies,
      spireAnchors,
    },
  };
}
