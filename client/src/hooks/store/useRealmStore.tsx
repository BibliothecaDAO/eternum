import { create } from "zustand";

interface Realm {
  realmId: BigInt | undefined;
  setRealmId: (realmId: BigInt) => void;
  realmEntityId: BigInt;
  setRealmEntityId: (realmEntityId: BigInt) => void;
  realmEntityIds: { realmEntityId: BigInt; realmId: BigInt }[];
  setRealmEntityIds: (realmEntityIds: { realmEntityId: BigInt; realmId: BigInt }[]) => void;
  hyperstructureId: BigInt | undefined;
  setHyperstructureId: (hyperstructureId: BigInt) => void;
}

const useRealmStore = create<Realm>((set) => {
  const realmEntityIds: { realmEntityId: BigInt; realmId: BigInt }[] = [];

  // TODO: put this as undefined first
  const realmEntityId = 9999n;
  const realmId = undefined;
  const hyperstructureId = undefined;

  return {
    realmEntityId,
    setRealmEntityId: (realmEntityId: BigInt) => set({ realmEntityId }),
    realmEntityIds,
    setRealmEntityIds: (realmEntityIds: { realmEntityId: BigInt; realmId: BigInt }[]) => {
      set({ realmEntityIds });
    },
    realmId,
    setRealmId: (realmId: BigInt) => set({ realmId }),
    hyperstructureId,
    setHyperstructureId: (hyperstructureId: BigInt) => set({ hyperstructureId }),
  };
});

export default useRealmStore;
