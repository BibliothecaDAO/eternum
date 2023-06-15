import { create } from 'zustand';
import { createPopupsSlice, PopupsStore } from './_popups';
export type Background = 'map' | 'realmView' | 'combat' | 'bastion';

interface UIStore {
    theme: string;
    setTheme: (theme: string) => void;
    cameraPosition: any,
    setCameraPosition: (position: any) => void,
    cameraTarget: any,
    setCameraTarget: (target: any) => void,
    showRealmsFlags: boolean,
    setShowRealmsFlags: (show: boolean) => void,
}

const useUIStore = create<UIStore & PopupsStore>((set) => ({
    theme: 'light',
    setTheme: (theme) => set({ theme }),
    cameraPosition: { x: 0, y: 700, z: 0 },
    setCameraPosition: (position) => set({ cameraPosition: position }),
    cameraTarget: { x: 0, y: 0, z: 0 },
    setCameraTarget: (target) => set({ cameraTarget: target }),
    showRealmsFlags: false,
    setShowRealmsFlags: (show) => set({ showRealmsFlags: show }),
    ...createPopupsSlice(set),
}));

export default useUIStore;