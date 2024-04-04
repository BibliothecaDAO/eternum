export enum BuildingType {
  Castle,
  Farm,
  Fishery,
  Mine,
  Stable,
  Workhut,
  ArcherRange,
  Barracks,
  Market,
  Storehouse,
}

export interface BuildModeStore {
  previewBuilding: BuildingType | null;
  setPreviewBuilding: (previewBuilding: BuildingType | null) => void;
  hoveredBuildHex: { col: number; row: number };
  setHoveredBuildHex: (hoveredBuildHex: { col: number; row: number }) => void;
  existingBuildings: { col: number; row: number; type: BuildingType }[];
  setExistingBuildings: (existingBuildings: { col: number; row: number; type: BuildingType }[]) => void;
}
export const createBuildModeStoreSlice = (set: any) => ({
  previewBuilding: null,
  setPreviewBuilding: (previewBuilding: BuildingType | null) => {
    set({ previewBuilding });
  },
  hoveredBuildHex: { col: -50, row: -50 },
  setHoveredBuildHex: (hoveredBuildHex: { col: number; row: number }) => set({ hoveredBuildHex }),
  existingBuildings: [{ col: 4, row: 4, type: BuildingType.Castle }],
  setExistingBuildings: (existingBuildings: { col: number; row: number; type: BuildingType }[]) =>
    set({ existingBuildings }),
});
