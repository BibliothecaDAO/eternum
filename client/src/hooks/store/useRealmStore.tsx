import { create } from "zustand";

interface Realm {
  realmId: bigint | undefined;
  setRealmId: (realmId: bigint) => void;
  realmEntityId: bigint;
  setRealmEntityId: (realmEntityId: bigint) => void;
  realmEntityIds: { realmEntityId: bigint; realmId: bigint }[];
  setRealmEntityIds: (realmEntityIds: { realmEntityId: bigint; realmId: bigint }[]) => void;
  hyperstructureId: bigint | undefined;
  setHyperstructureId: (hyperstructureId: bigint) => void;
}

const useRealmStore = create<Realm>((set) => {
  const realmEntityIds: { realmEntityId: bigint; realmId: bigint }[] = [];

  // TODO: put this as undefined first
  const realmEntityId = 9999n;
  const realmId = undefined;
  const hyperstructureId = undefined;

  return {
    realmEntityId,
    setRealmEntityId: (realmEntityId: bigint) => set({ realmEntityId }),
    realmEntityIds,
    setRealmEntityIds: (realmEntityIds: { realmEntityId: bigint; realmId: bigint }[]) => {
      set({ realmEntityIds });
    },
    realmId,
    setRealmId: (realmId: bigint) => set({ realmId }),
    hyperstructureId,
    setHyperstructureId: (hyperstructureId: bigint) => set({ hyperstructureId }),
  };
});

export default useRealmStore;
