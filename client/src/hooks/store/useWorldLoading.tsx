// World loading state
import { create } from "zustand";

interface WorldState {
  isWorldLoading: boolean;
  isMarketLoading: boolean;
  isStructuresLoading: boolean;
  setWorldLoading: (loading: boolean) => void;
  setMarketLoading: (loading: boolean) => void;
  setStructuresLoading: (loading: boolean) => void;
}

export const useWorldStore = create<WorldState>((set) => ({
  isWorldLoading: true,
  isMarketLoading: true,
  isStructuresLoading: true,  
  setWorldLoading: (loading: boolean) => set({ isWorldLoading: loading }),
  setMarketLoading: (loading: boolean) => set({ isMarketLoading: loading }),
  setStructuresLoading: (loading: boolean) => set({ isStructuresLoading: loading }),
}));
