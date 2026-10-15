import { REALM_ASSETS } from "../structures/realm-design";
import {
  ChestModelPath,
  STRAGGLERS_MODEL_PATH,
  SHARED_BUILDING_MODEL_PATHS,
  SPIRE_MODEL_PATH,
  getStructureModelPaths,
} from "@/three/constants/scene-constants";
import { FALLEN_REALM_RUIN_PATH } from "../structures/fallen-realm";
import { StructureType } from "@bibliothecadao/types";
import { HYPERSTRUCTURE_MODEL_PATH } from "../structures/hyperstructure-design";

export interface TerrainLabBuilding {
  col: number;
  row: number;
  path: string;
  yaw: number;
  hyperstructureId?: number;
  constructionProgress?: number;
  /** A spire found by a Blitz reveal: no portal, still. */
  dormant?: boolean;
}

const BUILDING_LABELS: Record<string, string> = {
  settlement: "Realm · Settlement",
  city: "Realm · City",
  kingdom: "Realm · Kingdom",
  empire: "Realm · Empire",
  village: "Village · Canvas & Thatch",
  camp: "Camp · Canvas and stockade",
  stragglers: "Stragglers · Stranded company",
  archerrange: "Archery range",
  castle1: "Hall / Holy site",
  fishery: "Fishery",
  chest_model: "Chest",
  ruin: "Ruin · Fallen realm",
  spire: "Spire · Levitating portal",
};

export const TERRAIN_LAB_BUILDINGS = [
  ...new Set([
    ...SHARED_BUILDING_MODEL_PATHS,
    STRAGGLERS_MODEL_PATH,
    FALLEN_REALM_RUIN_PATH,
    "/models/outposts/shrine.glb",
    "/models/outposts/well.glb",
    ChestModelPath,
    SPIRE_MODEL_PATH,
  ]),
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
        : (REALM_ASSETS.find((asset) => asset.path === path)?.label ??
          BUILDING_LABELS[filename] ??
          filename.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())),
  };
});

const STRUCTURE_TYPE_BY_PATH = new Map(
  Object.entries(getStructureModelPaths()).flatMap(([type, paths]) =>
    paths.map((path) => [path, Number(type) as StructureType] as const),
  ),
);
export function resolveTerrainLabStructureType(path: string): StructureType | undefined {
  return STRUCTURE_TYPE_BY_PATH.get(path);
}
