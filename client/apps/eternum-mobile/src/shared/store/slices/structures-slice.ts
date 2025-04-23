import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/shared/consts";
import { ID, RealmInfo } from "@bibliothecadao/types";

export interface StructuresSlice {
  selectedRealm: RealmInfo | null;
  structureEntityId: ID;
  setSelectedStructure: (realm: RealmInfo | null) => void;
}

export const createStructuresSlice = (set: any) => ({
  selectedRealm: null,
  structureEntityId: UNDEFINED_STRUCTURE_ENTITY_ID,
  setSelectedStructure: (realm: RealmInfo | null) => {
    console.log("Setting structure in store:", realm?.entityId);
    set({
      selectedRealm: realm,
      structureEntityId: realm?.entityId ?? UNDEFINED_STRUCTURE_ENTITY_ID,
    });
  },
});
