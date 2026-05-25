export interface PopupsStore {
  openedPopups: string[];
  openPopup: (name: string) => void;
  closePopup: (name: string) => void;
  closeAllPopups: () => void;
  isPopupOpen: (name: string) => boolean;
  togglePopup: (name: string) => void;
  openAllPopups: (names: string[]) => void;
}

export const createPopupsSlice = (
  set: (partial: Partial<PopupsStore> | ((state: PopupsStore) => Partial<PopupsStore>)) => void,
  get: () => PopupsStore,
) => ({
  openedPopups: [],
  openPopup: (name: string) => set((state) => ({ openedPopups: [...state.openedPopups, name] })),
  closePopup: (name: string) =>
    set((state) => ({ openedPopups: state.openedPopups.filter((_name) => _name !== name) })),
  closeAllPopups: () => set({ openedPopups: [] }),
  isPopupOpen: (name: string) => get().openedPopups.includes(name),
  togglePopup: (name: string) => {
    const isOpen = get().isPopupOpen(name);
    if (isOpen) {
      set((state) => ({ openedPopups: state.openedPopups.filter((_name) => _name !== name) }));
    } else {
      set((state) => ({ openedPopups: [...state.openedPopups, name] }));
    }
  },
  openAllPopups: (names: string[]) => {
    set({ openedPopups: [...get().openedPopups, ...names] });
  },
});
