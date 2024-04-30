import { BuildingType, ResourcesIds } from "@bibliothecadao/eternum";
import { Entity } from "@dojoengine/recs";

export interface BuildModeStore {
  isDestroyMode: boolean;
  setIsDestroyMode: (isDestroyMode: boolean) => void;
  previewBuilding: BuildingType | null;
  setPreviewBuilding: (previewBuilding: BuildingType | null) => void;
  hoveredBuildHex: { col: number; row: number } | null;
  setHoveredBuildHex: (hoveredBuildHex: { col: number; row: number } | null) => void;
  existingBuildings: { col: number; row: number; type: BuildingType; entity?: Entity; resource?: ResourcesIds }[];
  setExistingBuildings: (
    existingBuildings: { col: number; row: number; type: BuildingType; entity?: Entity; resource?: ResourcesIds }[],
  ) => void;
  setResourceId: (resourceId: ResourcesIds | null) => void;
  selectedResource: ResourcesIds | null;
}
export const createBuildModeStoreSlice = (set: any) => ({
  isDestroyMode: false,
  setIsDestroyMode: (isDestroyMode: boolean) => set({ isDestroyMode }),
  previewBuilding: null,
  setPreviewBuilding: (previewBuilding: BuildingType | null) => {
    set({ previewBuilding });
  },
  hoveredBuildHex: null,
  setHoveredBuildHex: (hoveredBuildHex: { col: number; row: number } | null) => set({ hoveredBuildHex }),
  existingBuildings: [{ col: 4, row: 4, type: BuildingType.Castle }],
  setExistingBuildings: (
    existingBuildings: { col: number; row: number; type: BuildingType; entity?: Entity; resource?: ResourcesIds }[],
  ) => set({ existingBuildings }),
  selectedResource: ResourcesIds.Wheat,
  setResourceId: (resourceId: ResourcesIds | null) => set({ selectedResource: resourceId }),
});
