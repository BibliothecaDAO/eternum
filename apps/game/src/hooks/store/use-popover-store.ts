import { create } from "zustand";

/**
 * Which anchored popover is open. At most one: opening another closes the current one, so a popover never needs
 * a scrim to guarantee exclusivity.
 */
interface PopoverStore {
  openId: string | null;
  open: (id: string) => void;
  close: (id?: string) => void;
  toggle: (id: string) => void;
}

export const usePopoverStore = create<PopoverStore>()((set) => ({
  openId: null,
  open: (id) => set({ openId: id }),
  close: (id) => set((state) => (id === undefined || state.openId === id ? { openId: null } : state)),
  toggle: (id) => set((state) => ({ openId: state.openId === id ? null : id })),
}));
