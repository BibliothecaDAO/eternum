import { BuildingType, ResourcesIds } from "@bibliothecadao/eternum";
import { Entity } from "@dojoengine/recs";

export interface BuildModeStore {
  isDestroyMode: boolean;
  setIsDestroyMode: (isDestroyMode: boolean) => void;
  previewBuilding: { type: BuildingType; resource?: ResourcesIds } | null;
  setPreviewBuilding: (previewBuilding: { type: BuildingType; resource?: ResourcesIds } | null) => void;
  hoveredBuildHex: { col: number; row: number } | null;
  setHoveredBuildHex: (hoveredBuildHex: { col: number; row: number } | null) => void;
  existingBuildings: { col: number; row: number; type: BuildingType; entity?: Entity; resource?: ResourcesIds }[];
  setExistingBuildings: (
    existingBuildings: { col: number; row: number; type: BuildingType; entity?: Entity; resource?: ResourcesIds }[],
  ) => void;
}
export const createBuildModeStoreSlice = (set: any) => ({
  isDestroyMode: false,
  setIsDestroyMode: (isDestroyMode: boolean) => set({ isDestroyMode }),
  previewBuilding: null,
  setPreviewBuilding: (previewBuilding: { type: BuildingType; resource?: ResourcesIds } | null) => {
    set({ previewBuilding });
  },
  hoveredBuildHex: null,
  setHoveredBuildHex: (hoveredBuildHex: { col: number; row: number } | null) => set({ hoveredBuildHex }),
  existingBuildings: [{ col: 4, row: 4, type: BuildingType.Castle }],
  setExistingBuildings: (
    existingBuildings: { col: number; row: number; type: BuildingType; entity?: Entity; resource?: ResourcesIds }[],
  ) => set({ existingBuildings }),
});
