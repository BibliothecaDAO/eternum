import { ChestModelPath, SHARED_BUILDING_MODEL_PATHS, getStructureModelPaths } from "@/three/constants/scene-constants";
import { StructureType } from "@bibliothecadao/types";

export interface TerrainLabBuilding {
  col: number;
  row: number;
  path: string;
  yaw: number;
}

const BUILDING_LABELS: Record<string, string> = {
  settlement: "Realm · Settlement",
  city: "Realm · City",
  kingdom: "Realm · Kingdom",
  empire: "Realm · Empire",
  village: "Camp / Village · Three yurts",
  archerrange: "Archery range",
  castle1: "Hall / Holy site",
  fishery: "Fishery",
  hyperstructure_init: "Hyperstructure · Foundation",
  hyperstructure_half: "Hyperstructure · Half built",
  hyperstructure_finish: "Hyperstructure · Complete",
  wonder2: "Wonder",
  chest_model: "Chest",
};

export const TERRAIN_LAB_BUILDINGS = [...new Set([...SHARED_BUILDING_MODEL_PATHS, ChestModelPath])].map((path) => {
  const filename = path
    .split("/")
    .at(-1)!
    .replace(/\.glb$/, "");
  return {
    path,
    label: BUILDING_LABELS[filename] ?? filename.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()),
  };
});

const STRUCTURE_TYPE_BY_PATH = new Map(
  Object.entries(getStructureModelPaths(false)).flatMap(([type, paths]) =>
    paths.map((path) => [path, Number(type) as StructureType] as const),
  ),
);
export function resolveTerrainLabStructureType(path: string): StructureType | undefined {
  return STRUCTURE_TYPE_BY_PATH.get(path);
}
