import { StateCreator } from "zustand";

export interface ToSSlice {
  hasAcceptedToS: boolean;
  showToS: boolean;
  setHasAcceptedToS: (value: boolean) => void;
  setShowToS: (value: boolean) => void;
}

export const createToSSlice: StateCreator<ToSSlice> = (set) => ({
  hasAcceptedToS: false,
  showToS: false,
  setHasAcceptedToS: (value) => set({ hasAcceptedToS: value }),
  setShowToS: (value) => set({ showToS: value }),
});
