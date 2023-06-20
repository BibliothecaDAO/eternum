export interface PopupsStore {
    openedPopups: string[];
    openPopup: (name: string) => void;
    closePopup: (name: string) => void;
    closeAllPopups: () => void;
}
export const createPopupsSlice = (set) => ({
    openedPopups: [],
    openPopup: (name: string) => set((state) => ({ openedPopups: [...state.openedPopups, name] })),
    closePopup: (name: string) => set((state) => ({ openedPopups: state.openedPopups.filter(_name => _name !== name) })),
    closeAllPopups: () => set({ openedPopups: []})
  })