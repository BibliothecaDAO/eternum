export interface CommandSlice {
  lastRefreshedAt: number;
  collapsedSections: Record<string, boolean>;
  setCollapsed: (section: string, collapsed: boolean) => void;
  setLastRefreshed: () => void;
}

export const createCommandSlice = (set: any): CommandSlice => ({
  lastRefreshedAt: Date.now(),
  collapsedSections: {},
  setCollapsed: (section: string, collapsed: boolean) =>
    set((state: CommandSlice) => ({
      collapsedSections: {...state.collapsedSections, [section]: collapsed},
    })),
  setLastRefreshed: () => set({lastRefreshedAt: Date.now()}),
});
