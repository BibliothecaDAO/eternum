import {
  ChestModelPath,
  SHARED_BUILDING_MODEL_PATHS,
  SPIRE_MODEL_PATH,
  getStructureModelPaths,
} from "@/three/constants/scene-constants";
import { StructureType } from "@bibliothecadao/types";
import { HYPERSTRUCTURE_MODEL_PATH } from "../structures/hyperstructure-design";

export interface TerrainLabBuilding {
  col: number;
  row: number;
  path: string;
  yaw: number;
  hyperstructureId?: number;
  constructionProgress?: number;
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
  wonder2: "Wonder",
  chest_model: "Chest",
  spire: "Spire · Levitating portal",
};

export const TERRAIN_LAB_BUILDINGS = [
  ...new Set([...SHARED_BUILDING_MODEL_PATHS, ChestModelPath, SPIRE_MODEL_PATH]),
].map((path) => {
  const filename = path
    .split("/")
    .at(-1)!
    .replace(/\.glb$/, "");
  return {
    path,
    label:
      path === HYPERSTRUCTURE_MODEL_PATH
        ? "Hyperstructure · Procedural tower"
        : (BUILDING_LABELS[filename] ?? filename.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())),
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
