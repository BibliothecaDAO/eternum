import { BUILDINGS_CENTER, BuildingType, type HexPosition, ResourcesIds, StructureType } from "@bibliothecadao/types";

/** The ghost building the local view shows: following the pointer, or standing on the plot a build sheet chose. */
type PreviewBuilding = { type: BuildingType | StructureType; resource?: ResourcesIds; plot?: HexPosition };

export interface BuildModeStore {
  previewBuilding: PreviewBuilding | null;
  setPreviewBuilding: (previewBuilding: PreviewBuilding | null) => void;
  /** The building Next up asks the player to build in their own realm: the local view marks an open plot for it. */
  askedBuilding: BuildingType | null;
  setAskedBuilding: (askedBuilding: BuildingType | null) => void;
  existingBuildings: { col: number; row: number; type: BuildingType; entity?: string; resource?: ResourcesIds }[];
  setExistingBuildings: (
    existingBuildings: { col: number; row: number; type: BuildingType; entity?: string; resource?: ResourcesIds }[],
  ) => void;
}
export const createBuildModeStoreSlice = (set: (partial: Partial<BuildModeStore>) => void) => ({
  previewBuilding: null,
  setPreviewBuilding: (previewBuilding: PreviewBuilding | null) => {
    set({ previewBuilding });
  },
  askedBuilding: null,
  setAskedBuilding: (askedBuilding: BuildingType | null) => set({ askedBuilding }),
  existingBuildings: [{ col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1], type: BuildingType.ResourceLabor }],
  setExistingBuildings: (
    existingBuildings: { col: number; row: number; type: BuildingType; entity?: string; resource?: ResourcesIds }[],
  ) => set({ existingBuildings }),
});
