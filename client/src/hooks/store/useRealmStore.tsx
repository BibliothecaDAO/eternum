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

  // Set realmEntityId as the first element of realmEntityIds or default to 9999
  const realmEntityId =
    realmEntityIds.length > 0 ? realmEntityIds[0].realmEntityId : 9999;
  const realmId =
    realmEntityIds.length > 0 ? realmEntityIds[0].realmId : undefined;

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
