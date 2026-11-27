import { REALM_ASSETS } from "../structures/realm-design";
import {
  SHARED_BUILDING_MODEL_PATHS,
  SPIRE_MODEL_PATH,
  getStructureModelPaths,
} from "@/three/constants/scene-constants";
import { FALLEN_REALM_RUIN_PATH, FRONTIER_BEAST_PATHS } from "../structures/frontier-beast";
import { StructureType } from "@bibliothecadao/types";
import { HYPERSTRUCTURE_MODEL_PATH } from "../structures/hyperstructure-design";
import { parseOutpostKitPath } from "../structures/outpost-kit";
import { isRuinKitPath } from "../structures/ruin-kit";
import { SHRINE_SITE_MODEL_PATH, WELL_SITE_MODEL_PATH } from "../structures/well-shrine-kit";

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

const PROCEDURAL_BUILDING_LABELS: Record<string, string> = {
  [HYPERSTRUCTURE_MODEL_PATH]: "Hyperstructure · Procedural tower",
  [WELL_SITE_MODEL_PATH]: "Well · Procedural spring",
  [SHRINE_SITE_MODEL_PATH]: "Shrine · Procedural sanctuary",
  [SPIRE_MODEL_PATH]: "Spire · Levitating portal",
};

const BUILDING_LABELS: Record<string, string> = {
  settlement: "Realm · Settlement",
  city: "Realm · City",
  kingdom: "Realm · Kingdom",
  empire: "Realm · Empire",
  village: "Village · Canvas & Thatch",
  camp: "Camp · Canvas and stockade",
  archerrange: "Archery range",
  castle1: "Hall / Holy site",
  fishery: "Fishery",
};

function buildingKeyFromPath(path: string): string {
  const outpostKind = parseOutpostKitPath(path);
  if (outpostKind) {
    return outpostKind;
  }
  if (path.startsWith("procedural:")) {
    return path.slice("procedural:".length).split(":").at(-1)!;
  }
  return path
    .split("/")
    .at(-1)!
    .replace(/\.glb$/, "");
}

function resolveTerrainLabBuildingLabel(path: string): string {
  if (Object.hasOwn(PROCEDURAL_BUILDING_LABELS, path)) {
    return PROCEDURAL_BUILDING_LABELS[path];
  }
  if (isRuinKitPath(path)) {
    return "Ruin · Fallen realm";
  }
  const realmLabel = REALM_ASSETS.find((asset) => asset.path === path)?.label;
  if (realmLabel) {
    return realmLabel;
  }
  const key = buildingKeyFromPath(path);
  return BUILDING_LABELS[key] ?? key.replaceAll(/[_-]+/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

export const TERRAIN_LAB_BUILDINGS = [
  ...new Set([
    ...SHARED_BUILDING_MODEL_PATHS,
    ...FRONTIER_BEAST_PATHS,
    FALLEN_REALM_RUIN_PATH,
    SHRINE_SITE_MODEL_PATH,
    WELL_SITE_MODEL_PATH,
    SPIRE_MODEL_PATH,
  ]),
].map((path) => ({
  path,
  label: resolveTerrainLabBuildingLabel(path),
}));

const STRUCTURE_TYPE_BY_PATH = new Map(
  Object.entries(getStructureModelPaths()).flatMap(([type, paths]) =>
    paths.map((path) => [path, Number(type) as StructureType] as const),
  ),
);
export function resolveTerrainLabStructureType(path: string): StructureType | undefined {
  return STRUCTURE_TYPE_BY_PATH.get(path);
}
