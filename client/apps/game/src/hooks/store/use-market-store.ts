import { create } from "zustand";

interface MarketStore {
  loading: boolean;
  setLoading: (loading: boolean) => void;
  selectedResource: number;
  setSelectedResource: (resource: number) => void;
}

export const useMarketStore = create<MarketStore>((set, _get) => {
  return {
    loading: false,
    setLoading: (loading) => set({ loading }),
    selectedResource: 1,
    setSelectedResource: (resource) => {
      set({ selectedResource: resource });
    },
  };
});
