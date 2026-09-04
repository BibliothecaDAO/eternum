import { StructureType } from "@bibliothecadao/types";

interface SyncedStructureRecord {
  entity_id: number;
  coord_x: number;
  coord_y: number;
  category?: number | string | null;
}

interface InitialStructureSelectionInput {
  ownedStructures: SyncedStructureRecord[];
  firstGlobalStructure: SyncedStructureRecord | null;
}

interface InitialStructureSelectionResult {
  selectedStructure: Pick<SyncedStructureRecord, "entity_id" | "coord_x" | "coord_y"> | null;
  spectator: boolean;
}

const toSelection = (
  structure: SyncedStructureRecord | null,
): Pick<SyncedStructureRecord, "entity_id" | "coord_x" | "coord_y"> | null => {
  if (!structure) {
    return null;
  }

  return {
    entity_id: structure.entity_id,
    coord_x: structure.coord_x,
    coord_y: structure.coord_y,
  };
};

export const resolveInitialStructureSelection = (
  input: InitialStructureSelectionInput,
): InitialStructureSelectionResult => {
  const preferredOwnedStructure =
    input.ownedStructures.find((structure) => Number(structure.category) === StructureType.Realm) ??
    input.ownedStructures[0] ??
    null;

  if (preferredOwnedStructure) {
    return {
      selectedStructure: toSelection(preferredOwnedStructure),
      spectator: false,
    };
  }

  return {
    selectedStructure: toSelection(input.firstGlobalStructure),
    spectator: true,
  };
};
