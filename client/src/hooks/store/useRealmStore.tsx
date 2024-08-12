import { ID } from "@bibliothecadao/eternum";
import { create } from "zustand";

interface Realm {
  realmId: ID | undefined;
  setRealmId: (realmId: ID) => void;
  realmEntityId: ID;
  setRealmEntityId: (realmEntityId: ID) => void;
  realmEntityIds: { realmEntityId: ID; realmId: ID }[];
  setRealmEntityIds: (realmEntityIds: { realmEntityId: ID; realmId: ID }[]) => void;
}

const STARTING_ENTITY_ID = 9999;

const useRealmStore = create<Realm>((set) => {
  const realmEntityIds: { realmEntityId: ID; realmId: ID }[] = [];

  // TODO: put this as undefined first
  const realmEntityId = STARTING_ENTITY_ID;
  const realmId = undefined;

  return {
    realmEntityId,
    setRealmEntityId: (realmEntityId: ID) => set({ realmEntityId }),
    realmEntityIds,
    setRealmEntityIds: (realmEntityIds: { realmEntityId: ID; realmId: ID }[]) => {
      set({ realmEntityIds });
    },
    realmId,
    setRealmId: (realmId: ID) => set({ realmId }),
  };
});

export default useRealmStore;
