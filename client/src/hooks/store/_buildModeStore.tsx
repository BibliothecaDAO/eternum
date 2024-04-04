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
  setPreviewBuilding: (previewBuilding: BuildingType) => void;
  hoveredBuildHex: { col: number; row: number };
  setHoveredBuildHex: (hoveredBuildHex: { col: number; row: number }) => void;
  existingBuildings: { col: number; row: number; type: BuildingType }[];
  setExistingBuildings: (existingBuildings: { col: number; row: number; type: BuildingType }[]) => void;
}
export const createBuildModeStoreSlice = (set: any) => ({
  previewBuilding: BuildingType.Farm,
  setPreviewBuilding: (previewBuilding: BuildingType | null) =>
    set({ previewBuilding, hoveredBuildHex: { col: 4, row: 4 } }),
  hoveredBuildHex: { col: 0, row: 0 },
  setHoveredBuildHex: (hoveredBuildHex: { col: number; row: number }) => set({ hoveredBuildHex }),
  existingBuildings: [{ col: 4, row: 4, type: BuildingType.Castle }],
  setExistingBuildings: (existingBuildings: { col: number; row: number; type: BuildingType }[]) =>
    set({ existingBuildings }),
});
