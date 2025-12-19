import { useCallback } from "react";
import { useUIStore } from "./use-ui-store";

export interface PopupsStore {
  openedPopups: string[];
  openPopup: (name: string) => void;
  closePopup: (name: string) => void;
  closeAllPopups: () => void;
  isPopupOpen: (name: string) => boolean;
  togglePopup: (name: string) => void;
  openAllPopups: (names: string[]) => void;
}

export const createPopupsSlice = (set: any, get: any) => ({
  openedPopups: [],
  openPopup: (name: string) => set((state: any) => ({ openedPopups: [...state.openedPopups, name] })),
  closePopup: (name: string) =>
    set((state: any) => ({ openedPopups: state.openedPopups.filter((_name: any) => _name !== name) })),
  closeAllPopups: () => set({ openedPopups: [] }),
  isPopupOpen: (name: string) => get().openedPopups.includes(name),
  togglePopup: (name: string) => {
    const isOpen = get().isPopupOpen(name);
    if (isOpen) {
      set((state: any) => ({ openedPopups: state.openedPopups.filter((_name: any) => _name !== name) }));
    } else {
      set((state: any) => ({ openedPopups: [...state.openedPopups, name] }));
    }
  },
  openAllPopups: (names: string[]) => {
    set({ openedPopups: [...get().openedPopups, ...names] });
  },
});

/**
 * Hook to check if a popup is open with a stable selector.
 * This avoids creating a new selector function on every render,
 * which can cause unnecessary re-renders.
 *
 * Usage: const isOpen = useIsPopupOpen("myPopup");
 *
 * Instead of: const isOpen = useUIStore((state) => state.isPopupOpen("myPopup"));
 */
export const useIsPopupOpen = (name: string): boolean => {
  return useUIStore(useCallback((state) => state.openedPopups.includes(name), [name]));
};

/**
 * Hook to get popup actions with stable references.
 * Returns memoized open, close, and toggle functions for a specific popup.
 */
export const usePopupActions = (name: string) => {
  const openPopup = useUIStore((state) => state.openPopup);
  const closePopup = useUIStore((state) => state.closePopup);
  const togglePopup = useUIStore((state) => state.togglePopup);

  return {
    open: useCallback(() => openPopup(name), [openPopup, name]),
    close: useCallback(() => closePopup(name), [closePopup, name]),
    toggle: useCallback(() => togglePopup(name), [togglePopup, name]),
  };
};

/**
 * Combined hook for popup state and actions.
 * Useful when you need both the open state and control functions.
 */
export const usePopup = (name: string) => {
  const isOpen = useIsPopupOpen(name);
  const actions = usePopupActions(name);

  return {
    isOpen,
    ...actions,
  };
};
