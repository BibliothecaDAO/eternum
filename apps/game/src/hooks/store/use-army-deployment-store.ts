import { create } from "zustand";

/** A suggestion's selection intent, consumed when the world map is ready. */
export const useArmyDeploymentStore = create<{
  suggestedStructureId: number | null;
  suggest: (structureId: number) => void;
  clear: () => void;
}>()((set) => ({
  suggestedStructureId: null,
  suggest: (suggestedStructureId) => set({ suggestedStructureId }),
  clear: () => set({ suggestedStructureId: null }),
}));
