import { create } from "zustand";

interface Realm {
  realmId: bigint | undefined;
  setRealmId: (realmId: bigint) => void;
  realmEntityId: bigint | undefined;
  setRealmEntityId: (realmEntityId: bigint) => void;
  realmEntityIds: { realmEntityId: bigint; realmId: bigint }[];
  setRealmEntityIds: (realmEntityIds: { realmEntityId: bigint; realmId: bigint }[]) => void;
}

const useRealmStore = create<Realm>((set) => {
  const realmEntityIds: { realmEntityId: bigint; realmId: bigint }[] = [];

  // TODO: put this as undefined first
  const realmEntityId = undefined;
  const realmId = undefined;

  return {
    realmEntityId,
    setRealmEntityId: (realmEntityId: bigint) => set({ realmEntityId }),
    realmEntityIds,
    setRealmEntityIds: (realmEntityIds: { realmEntityId: bigint; realmId: bigint }[]) => {
      set({ realmEntityIds });
    },
    realmId,
    setRealmId: (realmId: bigint) => set({ realmId }),
  };
});

export default useRealmStore;
