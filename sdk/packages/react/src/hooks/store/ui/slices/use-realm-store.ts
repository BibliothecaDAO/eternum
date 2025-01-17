import { ID } from "@bibliothecadao/eternum";
import { UNDEFINED_STRUCTURE_ENTITY_ID } from "../../../../constants/constants";

export interface RealmStore {
  structureEntityId: ID;
  setStructureEntityId: (structureEntityId: ID) => void;
}

export const createRealmStoreSlice = (set: any) => ({
  structureEntityId: UNDEFINED_STRUCTURE_ENTITY_ID,
  setStructureEntityId: (structureEntityId: ID) => set({ structureEntityId }),
});
