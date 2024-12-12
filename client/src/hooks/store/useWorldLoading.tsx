// World loading state
import { create } from "zustand";

interface WorldState {
  isWorldLoading: boolean;
  setWorldLoading: (loading: boolean) => void;
}

export const useWorldStore = create<WorldState>((set) => ({
  isWorldLoading: true,
  setWorldLoading: (loading: boolean) => set({ isWorldLoading: loading }),
}));
