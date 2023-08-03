import { create } from 'zustand';
import { createPopupsSlice, PopupsStore } from './_popups';
export type Background = 'map' | 'realmView' | 'combat' | 'bastion';

interface UIStore {
    theme: string;
    setTheme: (theme: string) => void;
    isSoundOn: boolean;
    toggleSound: () => void;
    cameraPosition: any,
    setCameraPosition: (position: any) => void,
    cameraTarget: any,
    setCameraTarget: (target: any) => void,
    showRealmsFlags: boolean,
    setShowRealmsFlags: (show: boolean) => void,
    moveCameraToWorldMapView: () => void,
    moveCameraToRealmView: () => void,
    moveCameraToCaravansView: () => void,
    moveCameraToLaborView: () => void
}

const useUIStore = create<UIStore & PopupsStore>((set) => ({
    theme: 'light',
    setTheme: (theme) => set({ theme }),
    isSoundOn: true,
    toggleSound: () => set((state) => ({ isSoundOn: !state.isSoundOn })),
    cameraPosition: { x: 0, y: 700, z: 0 },
    setCameraPosition: (position) => set({ cameraPosition: position }),
    cameraTarget: { x: 0, y: 0, z: 0 },
    setCameraTarget: (target) => set({ cameraTarget: target }),
    showRealmsFlags: false,
    setShowRealmsFlags: (show) => set({ showRealmsFlags: show }),
    moveCameraToWorldMapView: () => {
        const pos = { x: -17.044911069418, y: 118.38408187955699, z: 204.31967964950695 }
        const target = { x: -0.26346999995776943, y: 0.027105, z: 0.007405999987503547 }
        set({ cameraPosition: pos, cameraTarget: target })
    },
    moveCameraToRealmView: () => {
        const pos = { x: 617.4138155171775, y: 700.1390819999998, z: 1055.0299115304658 }
        const target = { x: 61.3221210638067, y: 0.1390819999999989, z: -22.35675413789002 }
        set({ cameraPosition: pos, cameraTarget: target })
    },
    moveCameraToCaravansView: () => {
        const target = { x: 455.04897289817836, y: 0.1390819999999993, z: 126.07263921942426 }
        const posi = { x: 777.8489507984942, y: 346.3026168062936, z: 631.3327234892186 }
        set({ cameraPosition: posi, cameraTarget: target })
    },
    moveCameraToLaborView: () => {
        const target = { x: 318.9662654578011, y: 0.13908199999999904, z: -216.45294399992537 }
        const pos = { x: 612.9471476458315, y: 788.8605838003339, z: 902.2488185381396 }
        set({ cameraPosition: pos, cameraTarget: target })
    },
    ...createPopupsSlice(set),
}));

export default useUIStore;