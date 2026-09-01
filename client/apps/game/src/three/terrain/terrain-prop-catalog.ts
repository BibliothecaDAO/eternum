export type TerrainPropLod = "near" | "far";

export const TERRAIN_PROP_CATALOG_PATH = "/models/procedural-terrain/ultimate-nature-props.glb";

export const TERRAIN_PROP_ARCHETYPE_IDS = Object.freeze([
  "broadleaf",
  "birch",
  "willow",
  "conifer",
  "palm",
  "dead-tree",
  "shrub",
  "cactus",
  "boulder",
  "stump",
  "fallen-log",
] as const);

export type TerrainPropArchetypeId = (typeof TERRAIN_PROP_ARCHETYPE_IDS)[number];
export type TerrainPropRole = "canopy" | "rigid" | "understory";
export type TerrainPropPlacementLayer = "canopy" | "debris" | "understory";

const CANOPY_ARCHETYPES = new Set<TerrainPropArchetypeId>(["broadleaf", "birch", "willow", "conifer", "palm"]);
const UNDERSTORY_ARCHETYPES = new Set<TerrainPropArchetypeId>(["shrub"]);
const DEBRIS_ARCHETYPES = new Set<TerrainPropArchetypeId>(["boulder", "dead-tree", "fallen-log", "stump"]);
const CANOPY_EXCLUSION_RADIUS: Partial<Record<TerrainPropArchetypeId, number>> = Object.freeze({
  birch: 0.28,
  broadleaf: 0.3,
  conifer: 0.34,
  palm: 0.42,
  willow: 0.48,
});
const SUCCESSION_AFFINITY: Readonly<Record<TerrainPropArchetypeId, number>> = Object.freeze({
  birch: 1,
  boulder: 0,
  broadleaf: 0.25,
  cactus: 0.55,
  conifer: 0.15,
  "dead-tree": 0,
  "fallen-log": 0,
  palm: 0.65,
  shrub: 1,
  stump: 0,
  willow: 0.35,
});
const DISTURBANCE_AFFINITY: Readonly<Record<TerrainPropArchetypeId, number>> = Object.freeze({
  birch: 1,
  boulder: 0,
  broadleaf: 0.1,
  cactus: 0,
  conifer: 0.2,
  "dead-tree": 0.55,
  "fallen-log": 0.85,
  palm: 0.2,
  shrub: 1,
  stump: 1,
  willow: 0.25,
});

export function getTerrainPropRole(archetype: TerrainPropArchetypeId): TerrainPropRole {
  if (CANOPY_ARCHETYPES.has(archetype)) return "canopy";
  if (UNDERSTORY_ARCHETYPES.has(archetype)) return "understory";
  return "rigid";
}

export function getTerrainPropPlacementLayer(archetype: TerrainPropArchetypeId): TerrainPropPlacementLayer {
  if (CANOPY_ARCHETYPES.has(archetype)) return "canopy";
  if (DEBRIS_ARCHETYPES.has(archetype)) return "debris";
  return "understory";
}

export function getTerrainPropCanopyExclusionRadius(archetype: TerrainPropArchetypeId): number {
  const radius = CANOPY_EXCLUSION_RADIUS[archetype];
  if (radius === undefined) throw new Error(`${archetype} is not a canopy terrain prop`);
  return radius;
}

export function getTerrainPropSuccessionAffinity(archetype: TerrainPropArchetypeId): number {
  return SUCCESSION_AFFINITY[archetype];
}

export function getTerrainPropDisturbanceAffinity(archetype: TerrainPropArchetypeId): number {
  return DISTURBANCE_AFFINITY[archetype];
}

export const getTerrainPropMeshName = (archetype: TerrainPropArchetypeId, lod: TerrainPropLod): string =>
  `${archetype}-${lod}`;

export const getRequiredTerrainPropMeshNames = (): string[] =>
  TERRAIN_PROP_ARCHETYPE_IDS.flatMap((archetype) => [
    getTerrainPropMeshName(archetype, "near"),
    getTerrainPropMeshName(archetype, "far"),
  ]);
