import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/ui/constants";
import { ID } from "@bibliothecadao/eternum";
export interface RealmStore {
  structureEntityId: ID;
  setStructureEntityId: (realmEntityId: ID) => void;
}

export const createRealmStoreSlice = (set: any) => ({
  structureEntityId: UNDEFINED_STRUCTURE_ENTITY_ID,
  setStructureEntityId: (realmEntityId: ID) => set({ realmEntityId }),
});
