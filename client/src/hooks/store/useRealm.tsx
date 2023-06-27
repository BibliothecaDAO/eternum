import { create } from 'zustand';
import { createPopupsSlice, PopupsStore } from './_popups';

interface Realm {
    realmEntityId: number;
}

const useRealm = create<Realm>((set) => ({
    realmEntityId: 0,
    setRealmEntityId: (realmEntityId: number) => set({ realmEntityId }),
}));

export default useRealm;