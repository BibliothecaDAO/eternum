import { create } from "zustand";

interface Realm {
  realmId: number | undefined;
  setRealmId: (realmId: number) => void;
  realmEntityId: number;
  setRealmEntityId: (realmEntityId: number) => void;
  realmEntityIds: { realmEntityId: number; realmId: number }[];
  setRealmEntityIds: (realmEntityIds: { realmEntityId: number; realmId: number }[]) => void;
  hyperstructureId: number | undefined;
  setHyperstructureId: (hyperstructureId: number) => void;
}

const useRealmStore = create<Realm>((set) => {
  const realmEntityIds: { realmEntityId: number; realmId: number }[] = [];

  // TODO: put this as undefined first
  const realmEntityId = 9999;
  const realmId = undefined;
  const hyperstructureId = undefined;

  return {
    realmEntityId,
    setRealmEntityId: (realmEntityId: number) => set({ realmEntityId }),
    realmEntityIds,
    setRealmEntityIds: (realmEntityIds: { realmEntityId: number; realmId: number }[]) => {
      set({ realmEntityIds });
    },
    realmId,
    setRealmId: (realmId: number) => set({ realmId }),
    hyperstructureId,
    setHyperstructureId: (hyperstructureId: number) => set({ hyperstructureId }),
  };
});

export default useRealmStore;
