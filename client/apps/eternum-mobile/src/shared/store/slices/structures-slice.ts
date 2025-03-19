import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/shared/consts";
import { ID, RealmInfo } from "@bibliothecadao/eternum";

export interface StructuresSlice {
  selectedRealm: RealmInfo | null;
  structureEntityId: ID;
  setSelectedStructure: (realm: RealmInfo | null) => void;
  setStructureEntityId: (structureEntityId: ID) => void;
}

export const createStructuresSlice = (set: any) => ({
  selectedRealm: null,
  structureEntityId: UNDEFINED_STRUCTURE_ENTITY_ID,
  setSelectedStructure: (realm: RealmInfo | null) =>
    set({ selectedRealm: realm, structureEntityId: realm?.entityId ?? UNDEFINED_STRUCTURE_ENTITY_ID }),
  setStructureEntityId: (structureEntityId: ID) => set({ structureEntityId }),
});
