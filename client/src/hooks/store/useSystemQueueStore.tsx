// hook to store the list of system calls
import { create } from 'zustand';

interface SystemQueue {
    systemQueue: (() => void)[];
    addToSystemQueue: (system: () => void) => void;
    setSystemQueue: (systemQueue: (() => void)[]) => void;
}

const useSystemQueueStore = create<SystemQueue>((set) => ({
    systemQueue: [],
    addToSystemQueue: (system: () => void) => set((state) => ({ systemQueue: [...state.systemQueue, system] })),
    setSystemQueue: (systemQueue: (() => void)[]) => set({ systemQueue }),
}));

export default useSystemQueueStore;



