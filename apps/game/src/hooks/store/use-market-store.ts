import { create } from "zustand";

interface MarketStore {
  selectedResource: number;
  setSelectedResource: (resource: number) => void;
}

export const useMarketStore = create<MarketStore>((set) => ({
  selectedResource: 1,
  setSelectedResource: (resource) => set({ selectedResource: resource }),
}));
