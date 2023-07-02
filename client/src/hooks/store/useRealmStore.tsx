import { create } from 'zustand';

// TODO: find a way to switch realms
interface Realm {
    realmEntityId: number;
    setRealmEntityId: (realmEntityId: number) => void,
}

const useRealmStore = create<Realm>((set) => ({
    realmEntityId: 0,
    setRealmEntityId: (realmEntityId: number) => set({ realmEntityId }),
}));

export default useRealmStore;