export interface UISlice {
  // Compact view state
  isCompactView: boolean;

  // Compact view actions
  toggleCompactView: () => void;
  setCompactView: (isCompact: boolean) => void;
}

export const createUISlice = (set: any) => ({
  // Initial compact view state
  isCompactView: true,

  // Compact view actions
  toggleCompactView: () => {
    set((state: UISlice) => ({
      isCompactView: !state.isCompactView,
    }));
  },

  setCompactView: (isCompact: boolean) => {
    set({ isCompactView: isCompact });
  },
});