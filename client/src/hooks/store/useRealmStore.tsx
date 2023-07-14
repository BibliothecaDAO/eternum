import { create } from 'zustand';

// TODO: find a way to switch realms
interface Realm {
    realmEntityId: number;
    setRealmEntityId: (realmEntityId: number) => void,
    realmEntityIds: number[],
    setRealmEntityIds: (realmEntityIds: number[]) => void,
}

const useRealmStore = create<Realm>((set) => {
    // Retrieve realmEntityIds from localStorage
    const realmEntityIdsStorage = localStorage.getItem('entityIds');
    const realmEntityIds = realmEntityIdsStorage ? [...JSON.parse(realmEntityIdsStorage)] : [];
    
    // Set realmEntityId as the first element of realmEntityIds or default to 9999
    const realmEntityId =
    realmEntityIds.length > 0 ? realmEntityIds[0] : 9999;

    return {
      realmEntityId,
      setRealmEntityId: (realmEntityId: number) => set({ realmEntityId }),
      realmEntityIds,
      setRealmEntityIds: (realmEntityIds: number[]) => {
        // Update localStorage with new realmEntityIds
        localStorage.setItem('entityIds', JSON.stringify(realmEntityIds));
        set({ realmEntityIds });
      },
    };
  });

export default useRealmStore;