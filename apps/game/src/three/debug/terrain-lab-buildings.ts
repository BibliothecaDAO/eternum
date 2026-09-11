import {
  VILLAGE_MODEL_PATH,
  ChestModelPath,
  SHARED_BUILDING_MODEL_PATHS,
  getStructureModelPaths,
} from "@/three/constants/scene-constants";
import { StructureType } from "@bibliothecadao/types";

export interface TerrainLabBuilding {
  col: number;
  row: number;
  path: string;
  yaw: number;
}

const BUILDING_LABELS: Record<string, string> = {
  "realm-settlement-draft": "Realm · Settlement draft",
  "village-draft": "Camp / Village · Timber mercenaries",
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

export const REALM_DRAFT_PATH = "/models/settlements/realm-settlement-draft.glb";

export const VILLAGE_DRAFT_PATH = VILLAGE_MODEL_PATH;

export const TERRAIN_LAB_BUILDINGS = [
  ...new Set([...SHARED_BUILDING_MODEL_PATHS, ChestModelPath, VILLAGE_DRAFT_PATH, REALM_DRAFT_PATH]),
].map((path) => {
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
STRUCTURE_TYPE_BY_PATH.set(VILLAGE_DRAFT_PATH, StructureType.Village);
STRUCTURE_TYPE_BY_PATH.set(REALM_DRAFT_PATH, StructureType.Realm);

export function resolveTerrainLabStructureType(path: string): StructureType | undefined {
  return STRUCTURE_TYPE_BY_PATH.get(path);
}
