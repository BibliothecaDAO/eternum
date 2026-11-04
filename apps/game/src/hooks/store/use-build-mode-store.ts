import { BUILDINGS_CENTER, BuildingType, type HexPosition, ResourcesIds, StructureType } from "@bibliothecadao/types";

/** The ghost building the local view shows: following the pointer, or standing on the plot a build sheet chose. */
type PreviewBuilding = { type: BuildingType | StructureType; resource?: ResourcesIds; plot?: HexPosition };

export interface BuildModeStore {
  previewBuilding: PreviewBuilding | null;
  setPreviewBuilding: (previewBuilding: PreviewBuilding | null) => void;
  /** The player's own realm's first build (first-build.ts): the local view lights an open plot for it. */
  firstBuild: BuildingType | null;
  setFirstBuild: (firstBuild: BuildingType | null) => void;
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
  firstBuild: null,
  setFirstBuild: (firstBuild: BuildingType | null) => set({ firstBuild }),
  existingBuildings: [{ col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1], type: BuildingType.ResourceLabor }],
  setExistingBuildings: (
    existingBuildings: { col: number; row: number; type: BuildingType; entity?: string; resource?: ResourcesIds }[],
  ) => set({ existingBuildings }),
});
