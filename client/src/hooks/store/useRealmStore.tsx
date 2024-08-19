import { ID } from "@bibliothecadao/eternum";
export interface RealmStore {
  structureEntityId: ID;
  setStructureEntityId: (realmEntityId: ID) => void;
}

export const createRealmStoreSlice = (set: any) => ({
  structureEntityId: 0,
  setStructureEntityId: (realmEntityId: ID) => set({ realmEntityId }),
});
