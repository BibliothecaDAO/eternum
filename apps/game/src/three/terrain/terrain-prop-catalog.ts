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

const CANOPY_ARCHETYPES = new Set<TerrainPropArchetypeId>(["broadleaf", "birch", "willow", "conifer", "palm"]);
const UNDERSTORY_ARCHETYPES = new Set<TerrainPropArchetypeId>(["shrub"]);

export function getTerrainPropRole(archetype: TerrainPropArchetypeId): TerrainPropRole {
  if (CANOPY_ARCHETYPES.has(archetype)) return "canopy";
  if (UNDERSTORY_ARCHETYPES.has(archetype)) return "understory";
  return "rigid";
}

export const getTerrainPropMeshName = (archetype: TerrainPropArchetypeId, lod: TerrainPropLod): string =>
  `${archetype}-${lod}`;

export const getRequiredTerrainPropMeshNames = (): string[] =>
  TERRAIN_PROP_ARCHETYPE_IDS.flatMap((archetype) => [
    getTerrainPropMeshName(archetype, "near"),
    getTerrainPropMeshName(archetype, "far"),
  ]);
