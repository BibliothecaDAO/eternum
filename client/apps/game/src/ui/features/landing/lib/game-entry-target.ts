import { resolveGameEntryTarget } from "../components/game-entry-navigation";

interface KnownStructureTarget {
  entityId: number;
  col: number;
  row: number;
}

interface ResolveKnownEntryTargetInput {
  isSpectateMode: boolean;
  uiStructureEntityId: number;
  worldMapReturnPosition: { col: number; row: number } | null;
  blitzPlayerStructure: KnownStructureTarget | null;
  eternumOwnedStructure: KnownStructureTarget | null;
}

export const resolveKnownEntryTarget = ({
  isSpectateMode,
  uiStructureEntityId,
  worldMapReturnPosition,
  blitzPlayerStructure,
  eternumOwnedStructure,
}: ResolveKnownEntryTargetInput) => {
  const directUiTarget = resolveGameEntryTarget({
    structureEntityId: uiStructureEntityId,
    worldMapReturnPosition,
    isSpectateMode,
  });
  if (directUiTarget) {
    return directUiTarget;
  }

  if (isSpectateMode) {
    return null;
  }

  const fallbackStructure = eternumOwnedStructure ?? blitzPlayerStructure;
  if (!fallbackStructure) {
    return null;
  }

  return {
    spectator: false,
    structureEntityId: fallbackStructure.entityId,
    url: `/play/map?col=${fallbackStructure.col}&row=${fallbackStructure.row}`,
    worldMapPosition: {
      col: fallbackStructure.col,
      row: fallbackStructure.row,
    },
  };
};
