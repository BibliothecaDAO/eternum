export interface BuildModeStore {
  buildMode: boolean;
  setBuildMode: (buildMode: boolean) => void;
  hoveredBuildHex: { col: number; row: number };
  setHoveredBuildHex: (hoveredBuildHex: { col: number; row: number }) => void;
  builtCastles: { col: number; row: number }[];
  setBuiltCastles: (builtCastles: { col: number; row: number }[]) => void;
}
export const createBuildModeStoreSlice = (set: any) => ({
  buildMode: false,
  setBuildMode: (buildMode: boolean) => set({ buildMode, hoveredBuildHex: { col: 4, row: 4 } }),
  hoveredBuildHex: { col: 0, row: 0 },
  setHoveredBuildHex: (hoveredBuildHex: { col: number; row: number }) => set({ hoveredBuildHex }),
  builtCastles: [],
  setBuiltCastles: (builtCastles: { col: number; row: number }[]) => set({ builtCastles }),
});
