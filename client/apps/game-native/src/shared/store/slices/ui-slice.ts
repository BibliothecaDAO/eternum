export interface UISlice {
  isCompactView: boolean;
  toggleCompactView: () => void;
  setCompactView: (isCompact: boolean) => void;
}

export const createUISlice = (set: any): UISlice => ({
  isCompactView: true,
  toggleCompactView: () =>
    set((state: UISlice) => ({isCompactView: !state.isCompactView})),
  setCompactView: (isCompact: boolean) => set({isCompactView: isCompact}),
});
