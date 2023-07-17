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
    moveCameraToWorldMapView: () => void,
    moveCameraToRealmView: () => void,
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
    moveCameraToWorldMapView: () => {
        const pos = {
            x: -7.043878696238032,
            y: 166.17021444157382,
            z: 222.6600723287719
        }
        const target = { x: 0.023274850081444903, y: -0.5977038789716049, z: -0.8013790329276046 }
        set({ cameraPosition: pos, cameraTarget: target })
    },
    moveCameraToRealmView: () => {
        const pos = {
            x: 399.79750334746063,
            y: 699.249767349755,
            z: 1163.119859554027
        }
        const target = {
            "x": -0.2596104873702977,
            "y": -0.5003629837749848,
            "z": -0.8259777716834455
        }
        set({ cameraPosition: pos, cameraTarget: target })
    },
    ...createPopupsSlice(set),
}));

export default useUIStore;