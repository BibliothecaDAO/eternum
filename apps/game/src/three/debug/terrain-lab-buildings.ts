import { ChestModelPath, SHARED_BUILDING_MODEL_PATHS } from "@/three/constants/scene-constants";

export interface TerrainLabBuilding {
  col: number;
  row: number;
  path: string;
  yaw: number;
}

const BUILDING_LABELS: Record<string, string> = {
  archerrange: "Archery range",
  castle0: "Realm · Settlement",
  castle1: "Realm · City",
  castle2: "Realm · Kingdom",
  castle3: "Realm · Empire",
  fishery: "Fishery",
  hyperstructure_init: "Hyperstructure · Foundation",
  hyperstructure_half: "Hyperstructure · Half built",
  hyperstructure_finish: "Hyperstructure · Complete",
  wonder2: "Wonder",
  chest_model: "Chest",
};

export const TERRAIN_LAB_BUILDINGS = [...SHARED_BUILDING_MODEL_PATHS, ChestModelPath].map((path) => {
  const filename = path
    .split("/")
    .at(-1)!
    .replace(/\.glb$/, "");
  return {
    path,
    label: BUILDING_LABELS[filename] ?? filename.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()),
  };
});
