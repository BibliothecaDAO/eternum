import { BuildingType, ResourcesIds, StructureType } from "@bibliothecadao/eternum";
import { Entity } from "@dojoengine/recs";
import { BUILDINGS_CENTER } from "@/three/scenes/constants";

export interface BuildModeStore {
  previewBuilding: { type: BuildingType | StructureType; resource?: ResourcesIds } | null;
  setPreviewBuilding: (previewBuilding: { type: BuildingType | StructureType; resource?: ResourcesIds } | null) => void;
  existingBuildings: { col: number; row: number; type: BuildingType; entity?: Entity; resource?: ResourcesIds }[];
  setExistingBuildings: (
    existingBuildings: { col: number; row: number; type: BuildingType; entity?: Entity; resource?: ResourcesIds }[],
  ) => void;
}
export const createBuildModeStoreSlice = (set: any) => ({
  previewBuilding: null,
  setPreviewBuilding: (previewBuilding: { type: BuildingType | StructureType; resource?: ResourcesIds } | null) => {
    set({ previewBuilding });
  },
  existingBuildings: [{ col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1], type: BuildingType.Castle }],
  setExistingBuildings: (
    existingBuildings: { col: number; row: number; type: BuildingType; entity?: Entity; resource?: ResourcesIds }[],
  ) => set({ existingBuildings }),
});
