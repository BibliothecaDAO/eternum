import { ID } from "@bibliothecadao/eternum";
export interface RealmStore {
  realmId: ID | undefined;
  setRealmId: (realmId: ID) => void;
  realmEntityId: ID;
  setRealmEntityId: (realmEntityId: ID) => void;
  realmEntityIds: { realmEntityId: ID; realmId: ID }[];
  setRealmEntityIds: (realmEntityIds: { realmEntityId: ID; realmId: ID }[]) => void;
}

export const createRealmStoreSlice = (set: any) => ({
  realmId: undefined,
  setRealmId: (realmId: ID) => set({ realmId }),
  realmEntityId: 0,
  setRealmEntityId: (realmEntityId: ID) => set({ realmEntityId }),
  realmEntityIds: [],
  setRealmEntityIds: (realmEntityIds: { realmEntityId: ID; realmId: ID }[]) => set({ realmEntityIds }),
});
