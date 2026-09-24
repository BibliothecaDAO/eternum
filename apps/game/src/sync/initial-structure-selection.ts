import { StructureType } from "@bibliothecadao/types";

interface SyncedStructureRecord {
  entity_id: number;
  coord_x: number;
  coord_y: number;
  category?: number | string | null;
}

interface InitialStructureSelectionInput {
  ownedStructures: SyncedStructureRecord[];
  /** Every structure in the game, in entity order; read only when the account owns none. */
  globalStructures: SyncedStructureRecord[];
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

/** The first realm, else the first structure: a spectator opens where the game is played, as a player does. */
const preferRealm = (structures: SyncedStructureRecord[]): SyncedStructureRecord | null =>
  structures.find((structure) => Number(structure.category) === StructureType.Realm) ?? structures[0] ?? null;

export const resolveInitialStructureSelection = (
  input: InitialStructureSelectionInput,
): InitialStructureSelectionResult => {
  const ownedStructure = preferRealm(input.ownedStructures);
  if (ownedStructure) {
    return { selectedStructure: toSelection(ownedStructure), spectator: false };
  }
  return { selectedStructure: toSelection(preferRealm(input.globalStructures)), spectator: true };
};
