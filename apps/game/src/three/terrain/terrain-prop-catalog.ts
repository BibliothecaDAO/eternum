import floraManifest from "../../../public/models/terrain-flora/manifest.json";

export type TerrainPropLod = "near" | "far";

export const TERRAIN_FLORA_MANIFEST_PATH = "/models/terrain-flora/manifest.json";

export const SURFACE_PROP_IDS = Object.freeze([
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

export const LAYER_PROP_IDS = Object.freeze([
  "glowcap",
  "root-arch",
  "bloom-coral",
  "hollow-fern",
  "standing-stone",
  "drift-banner",
  "frost-tuft",
] as const);

export const TERRAIN_PROP_ARCHETYPE_IDS = Object.freeze([...SURFACE_PROP_IDS, ...LAYER_PROP_IDS]);

export type SurfacePropId = (typeof SURFACE_PROP_IDS)[number];
export type LayerPropId = (typeof LAYER_PROP_IDS)[number];
export type TerrainPropArchetypeId = SurfacePropId | LayerPropId;

export const TERRAIN_PROP_PAGE_SLOT_CAPACITY: Readonly<Record<TerrainPropArchetypeId, number>> = Object.freeze({
  birch: 232,
  boulder: 432,
  broadleaf: 488,
  cactus: 384,
  conifer: 696,
  "dead-tree": 96,
  "fallen-log": 104,
  fern: 992,
  "grass-tuft": 568,
  palm: 296,
  cycad: 272,
  shrub: 568,
  mushroom: 64,
  glowcap: 328,
  "root-arch": 1952,
  "bloom-coral": 192,
  "hollow-fern": 432,
  "standing-stone": 704,
  "drift-banner": 160,
  "frost-tuft": 888,
  wildflower: 320,
  "rainforest-canopy": 288,
});
export const TERRAIN_PROP_PALETTE_SHIFT: Readonly<Record<SurfacePropId, number>> = Object.freeze({
  birch: 0.25,
  boulder: 0.25,
  broadleaf: 0.25,
  cactus: 0.25,
  conifer: 0.07,
  cycad: 0.25,
  "dead-tree": 0.25,
  "fallen-log": 0.25,
  fern: 0.25,
  "grass-tuft": 0.25,
  mushroom: 0.25,
  palm: 0.25,
  "rainforest-canopy": 0.25,
  shrub: 0.25,
  wildflower: 0.25,
});
const FLORA_FOOTPRINT_RADIUS = Object.fromEntries(
  TERRAIN_PROP_ARCHETYPE_IDS.map((archetype) => {
    const row = floraManifest.species.find(({ id }) => id === archetype);
    if (!row) throw new Error(`The flora manifest has no species for terrain prop ${archetype}`);
    return [archetype, row.radius];
  }),
) as Record<TerrainPropArchetypeId, number>;

const SPACING_SHARE: Readonly<Record<TerrainPropPlacementLayer, number>> = Object.freeze({
  canopy: 0.55,
  debris: 0.8,
  groundcover: 0,
  understory: 0.8,
});

export type TerrainPropRole = "canopy" | "groundcover" | "rigid" | "understory";
export type TerrainPropPlacementLayer = "canopy" | "debris" | "groundcover" | "understory";

const CANOPY_ARCHETYPES = new Set<TerrainPropArchetypeId>([
  "broadleaf",
  "birch",
  "rainforest-canopy",
  "conifer",
  "palm",
  "standing-stone",
]);
const UNDERSTORY_ARCHETYPES = new Set<TerrainPropArchetypeId>(["shrub", "drift-banner"]);
const GROUND_COVER_ARCHETYPES = new Set<TerrainPropArchetypeId>([
  "fern",
  "grass-tuft",
  "cycad",
  "wildflower",
  "hollow-fern",
  "frost-tuft",
]);
const DEBRIS_ARCHETYPES = new Set<TerrainPropArchetypeId>([
  "boulder",
  "dead-tree",
  "fallen-log",
  "mushroom",
  "glowcap",
]);
const SUCCESSION_AFFINITY: Readonly<Record<SurfacePropId, number>> = Object.freeze({
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
const DISTURBANCE_AFFINITY: Readonly<Record<SurfacePropId, number>> = Object.freeze({
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

const WETLAND_AFFINITY: Readonly<Record<SurfacePropId, number>> = Object.freeze({
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

type LayerPropAnchor = "scatter" | "edge" | "corner";

const LAYER_PROP_ANCHOR: Readonly<Record<LayerPropId, LayerPropAnchor>> = Object.freeze({
  glowcap: "scatter",
  "root-arch": "edge",
  "bloom-coral": "scatter",
  "hollow-fern": "scatter",
  "standing-stone": "corner",
  "drift-banner": "scatter",
  "frost-tuft": "scatter",
});

export function getLayerPropAnchor(archetype: LayerPropId): LayerPropAnchor {
  return LAYER_PROP_ANCHOR[archetype];
}

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

export function getTerrainPropFootprintRadius(archetype: TerrainPropArchetypeId): number {
  return FLORA_FOOTPRINT_RADIUS[archetype];
}

export function getTerrainPropSpacingRadius(archetype: TerrainPropArchetypeId): number {
  return FLORA_FOOTPRINT_RADIUS[archetype] * SPACING_SHARE[getTerrainPropPlacementLayer(archetype)];
}

export function getTerrainPropSuccessionAffinity(archetype: SurfacePropId): number {
  return SUCCESSION_AFFINITY[archetype];
}

export function getTerrainPropDisturbanceAffinity(archetype: SurfacePropId): number {
  return DISTURBANCE_AFFINITY[archetype];
}

export function getTerrainPropWetlandAffinity(archetype: SurfacePropId): number {
  return WETLAND_AFFINITY[archetype];
}

export function isTerrainGroundCover(archetype: TerrainPropArchetypeId): boolean {
  return GROUND_COVER_ARCHETYPES.has(archetype);
}

export function isTerrainPropVisibleAtLod(archetype: TerrainPropArchetypeId, lod: TerrainPropLod): boolean {
  return lod === "near" || !isTerrainGroundCover(archetype);
}
