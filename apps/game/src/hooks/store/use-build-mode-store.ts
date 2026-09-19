import { BUILDINGS_CENTER, BuildingType, ResourcesIds, StructureType } from "@bibliothecadao/types";

export interface BuildModeStore {
  previewBuilding: { type: BuildingType | StructureType; resource?: ResourcesIds } | null;
  setPreviewBuilding: (previewBuilding: { type: BuildingType | StructureType; resource?: ResourcesIds } | null) => void;
  existingBuildings: { col: number; row: number; type: BuildingType; entity?: string; resource?: ResourcesIds }[];
  setExistingBuildings: (
    existingBuildings: { col: number; row: number; type: BuildingType; entity?: string; resource?: ResourcesIds }[],
  ) => void;
}
export const createBuildModeStoreSlice = (set: (partial: Partial<BuildModeStore>) => void) => ({
  previewBuilding: null,
  setPreviewBuilding: (previewBuilding: { type: BuildingType | StructureType; resource?: ResourcesIds } | null) => {
    set({ previewBuilding });
  },
  existingBuildings: [{ col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1], type: BuildingType.ResourceLabor }],
  setExistingBuildings: (
    existingBuildings: { col: number; row: number; type: BuildingType; entity?: string; resource?: ResourcesIds }[],
  ) => set({ existingBuildings }),
});
