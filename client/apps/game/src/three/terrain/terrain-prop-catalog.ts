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

export const getTerrainPropMeshName = (archetype: TerrainPropArchetypeId, lod: TerrainPropLod): string =>
  `${archetype}-${lod}`;

export const getRequiredTerrainPropMeshNames = (): string[] =>
  TERRAIN_PROP_ARCHETYPE_IDS.flatMap((archetype) => [
    getTerrainPropMeshName(archetype, "near"),
    getTerrainPropMeshName(archetype, "far"),
  ]);
