import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface DevPreviewEntryStateRecord {
  previewEntered: boolean;
  enteredAt: number;
  loadoutWorldKey: string;
}

interface DevPreviewEntryStoreState {
  entries: Record<string, DevPreviewEntryStateRecord>;
  getPreviewEntry: (key: string) => DevPreviewEntryStateRecord | undefined;
  hasPreviewEntry: (key: string) => boolean;
  setPreviewEntry: (key: string, entry: DevPreviewEntryStateRecord) => void;
  clearPreviewEntry: (key: string) => void;
  clearAllPreviewEntries: () => void;
}

export const DEV_PREVIEW_ENTRY_STORAGE_KEY = "eternum-dev-preview-entry";

const createSessionStorage = () => {
  if (typeof window !== "undefined" && window.sessionStorage) {
    return window.sessionStorage;
  }

  const storage = new Map<string, string>();
  return {
    getItem: (name: string) => storage.get(name) ?? null,
    setItem: (name: string, value: string) => {
      storage.set(name, value);
    },
    removeItem: (name: string) => {
      storage.delete(name);
    },
  };
};

export const useDevPreviewEntryStore = create<DevPreviewEntryStoreState>()(
  persist(
    (set, get) => ({
      entries: {},
      getPreviewEntry: (key) => get().entries[key],
      hasPreviewEntry: (key) => Boolean(get().entries[key]?.previewEntered),
      setPreviewEntry: (key, entry) =>
        set((state) => ({
          entries: {
            ...state.entries,
            [key]: entry,
          },
        })),
      clearPreviewEntry: (key) =>
        set((state) => {
          const entries = { ...state.entries };
          delete entries[key];
          return { entries };
        }),
      clearAllPreviewEntries: () => set({ entries: {} }),
    }),
    {
      name: DEV_PREVIEW_ENTRY_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(createSessionStorage),
      partialize: (state) => ({ entries: state.entries }),
    },
  ),
);
