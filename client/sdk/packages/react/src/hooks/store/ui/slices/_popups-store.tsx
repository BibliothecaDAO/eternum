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
