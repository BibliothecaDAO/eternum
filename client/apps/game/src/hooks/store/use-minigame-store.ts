import { create } from "zustand";

type MinigameStore = {
  loading: boolean;
  minigames: undefined | any[];
  setMinigames: (minigames: any[] | undefined) => void;
  setLoading: (loading: boolean) => void;
};

export const useMinigameStore = create<MinigameStore>((set) => ({
  loading: false,
  minigames: undefined,
  setMinigames: (minigames: any[] | undefined) => set({ minigames }),
  setLoading: (loading: boolean) => set({ loading }),
}));
