import { create } from "zustand";

// TODO: find a way to switch realms
interface Realm {
  realmId: number | undefined;
  setRealmId: (realmId: number) => void;
  realmEntityId: number;
  setRealmEntityId: (realmEntityId: number) => void;
  realmEntityIds: { realmEntityId: number; realmId: number }[];
  setRealmEntityIds: (
    realmEntityIds: { realmEntityId: number; realmId: number }[],
  ) => void;
}

const useRealmStore = create<Realm>((set) => {
  // Retrieve realmEntityIds from localStorage
  const realmEntityIdsStorage = localStorage.getItem("entityIds");
  const realmEntityIds = realmEntityIdsStorage
    ? [...JSON.parse(realmEntityIdsStorage)]
    : [];

  // TODO: put this as undefined first
  const realmEntityId = 9999;
  const realmId = undefined;

  return {
    realmEntityId,
    setRealmEntityId: (realmEntityId: number) => set({ realmEntityId }),
    realmEntityIds,
    setRealmEntityIds: (
      realmEntityIds: { realmEntityId: number; realmId: number }[],
    ) => {
      // Update localStorage with new realmEntityIds
      localStorage.setItem("entityIds", JSON.stringify(realmEntityIds));
      set({ realmEntityIds });
    },
    realmId,
    setRealmId: (realmId: number) => set({ realmId }),
  };
});

export default useRealmStore;
