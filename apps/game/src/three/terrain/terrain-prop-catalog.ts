export type TerrainPropLod = "near" | "far";

export const TERRAIN_PROP_CATALOG_PATH = "/models/procedural-terrain/biome-kit-props.glb";

export const TERRAIN_PROP_ARCHETYPE_IDS = Object.freeze([
  "broadleaf",
  "birch",
  "rainforest-canopy",
  "conifer",
  "palm",
  "dead-tree",
  "shrub",
  "cactus",
  "boulder",
  "mushroom",
  "fallen-log",
  "grass-tuft",
  "fern",
  "cycad",
  "wildflower",
] as const);

export type TerrainPropArchetypeId = (typeof TERRAIN_PROP_ARCHETYPE_IDS)[number];

/**
 * Instances one terrain page holds per archetype: the size of its slot in the prop pools, and the most the generator
 * places on one page, so no page can outgrow its slot. Set at 1.5× the per-page maximum measured 2026-11-11 at
 * production density (the balanced benchmark fixture, homogeneous 3×3-page blocks of every biome, eight climate seed
 * pairs), rounded up to a multiple of 8, so the cap thins only a page denser than any measured.
 */
export const TERRAIN_PROP_PAGE_SLOT_CAPACITY: Readonly<Record<TerrainPropArchetypeId, number>> = Object.freeze({
  birch: 232, // measured 151
  boulder: 472, // measured 312
  broadleaf: 528, // measured 349
  cactus: 368, // measured 245
  conifer: 656, // measured 437
  "dead-tree": 120, // measured 80
  "fallen-log": 176, // measured 117
  fern: 768, // measured 512
  "grass-tuft": 568, // measured 376
  palm: 432, // measured 284
  cycad: 272, // measured 178
  shrub: 608, // measured 402
  mushroom: 88, // measured 55
  wildflower: 320, // measured 212
  "rainforest-canopy": 280, // measured 185
});
export type TerrainPropRole = "canopy" | "groundcover" | "rigid" | "understory";
export type TerrainPropPlacementLayer = "canopy" | "debris" | "groundcover" | "understory";

const CANOPY_ARCHETYPES = new Set<TerrainPropArchetypeId>([
  "broadleaf",
  "birch",
  "rainforest-canopy",
  "conifer",
  "palm",
]);
const UNDERSTORY_ARCHETYPES = new Set<TerrainPropArchetypeId>(["shrub"]);
const GROUND_COVER_ARCHETYPES = new Set<TerrainPropArchetypeId>(["fern", "grass-tuft", "cycad", "wildflower"]);
const DEBRIS_ARCHETYPES = new Set<TerrainPropArchetypeId>(["boulder", "dead-tree", "fallen-log", "mushroom"]);
const CANOPY_EXCLUSION_RADIUS: Partial<Record<TerrainPropArchetypeId, number>> = Object.freeze({
  birch: 0.28,
  broadleaf: 0.3,
  conifer: 0.34,
  palm: 0.42,
  "rainforest-canopy": 0.48,
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
  mushroom: 0,
  "rainforest-canopy": 0.35,
  fern: 0.9,
  "grass-tuft": 0.85,
  cycad: 1,
  wildflower: 0.95,
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
  mushroom: 1,
  "rainforest-canopy": 0.25,
  fern: 0.8,
  "grass-tuft": 0.9,
  cycad: 0.7,
  wildflower: 1,
});

const WETLAND_AFFINITY: Readonly<Record<TerrainPropArchetypeId, number>> = Object.freeze({
  birch: 0.35,
  boulder: 0.2,
  broadleaf: 0.45,
  cactus: 0,
  conifer: 0.2,
  "dead-tree": 0.35,
  fern: 0.9,
  "fallen-log": 0.65,
  "grass-tuft": 0.65,
  palm: 0.55,
  cycad: 1,
  shrub: 0.7,
  mushroom: 0.3,
  wildflower: 0.5,
  "rainforest-canopy": 1,
});

export function getTerrainPropRole(archetype: TerrainPropArchetypeId): TerrainPropRole {
  if (CANOPY_ARCHETYPES.has(archetype)) return "canopy";
  if (GROUND_COVER_ARCHETYPES.has(archetype)) return "groundcover";
  if (UNDERSTORY_ARCHETYPES.has(archetype)) return "understory";
  return "rigid";
}

export function getTerrainPropPlacementLayer(archetype: TerrainPropArchetypeId): TerrainPropPlacementLayer {
  if (CANOPY_ARCHETYPES.has(archetype)) return "canopy";
  if (DEBRIS_ARCHETYPES.has(archetype)) return "debris";
  if (GROUND_COVER_ARCHETYPES.has(archetype)) return "groundcover";
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

export function getTerrainPropWetlandAffinity(archetype: TerrainPropArchetypeId): number {
  return WETLAND_AFFINITY[archetype];
}

export function isTerrainGroundCover(archetype: TerrainPropArchetypeId): boolean {
  return GROUND_COVER_ARCHETYPES.has(archetype);
}

export function isTerrainPropVisibleAtLod(archetype: TerrainPropArchetypeId, lod: TerrainPropLod): boolean {
  return lod === "near" || !isTerrainGroundCover(archetype);
}

export const getTerrainPropMeshName = (archetype: TerrainPropArchetypeId, lod: TerrainPropLod): string =>
  `${archetype}-${lod}`;

export const getRequiredTerrainPropMeshNames = (): string[] =>
  TERRAIN_PROP_ARCHETYPE_IDS.flatMap((archetype) => [
    getTerrainPropMeshName(archetype, "near"),
    getTerrainPropMeshName(archetype, "far"),
  ]);
