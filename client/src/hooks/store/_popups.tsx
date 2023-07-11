export interface PopupsStore {
    openedPopups: string[];
    openPopup: (name: string) => void;
    closePopup: (name: string) => void;
    closeAllPopups: () => void;
}
export const createPopupsSlice = (set: any) => ({
    openedPopups: [],
    openPopup: (name: string) => set((state: any) => ({ openedPopups: [...state.openedPopups, name] })),
    closePopup: (name: string) => set((state: any) => ({ openedPopups: state.openedPopups.filter((_name: any) => _name !== name) })),
    closeAllPopups: () => set({ openedPopups: [] })
})