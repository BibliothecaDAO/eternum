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
  
    return {
      // TODO: automatically set the first of YOUR realmEntityId as first when refresh
      realmEntityId: 0,
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