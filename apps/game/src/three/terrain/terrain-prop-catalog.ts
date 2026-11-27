import { getFloraSpeciesMetadata } from "./flora-kit";

export type TerrainPropLod = "near" | "far";
export type TerrainPropRole = "canopy" | "groundcover" | "rigid" | "understory";
export type TerrainPropPlacementLayer = "canopy" | "debris" | "groundcover" | "understory";
type LayerPropAnchor = "scatter" | "edge" | "corner";

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

interface SurfaceFloraKind {
  family: "surface";
  role: TerrainPropRole;
  layer: TerrainPropPlacementLayer;
  measuredDensestPage: number;
  succession: number;
  disturbance: number;
  wetland: number;
  paletteShift?: number;
}

interface LayerFloraKind {
  family: "layer";
  role: TerrainPropRole;
  layer: TerrainPropPlacementLayer;
  measuredDensestPage: number;
  anchor: LayerPropAnchor;
}

type FloraKind = SurfaceFloraKind | LayerFloraKind;

const DEFAULT_PALETTE_SHIFT = 0.25;
const SLOT_HEADROOM_MULTIPLIER = 1.5;
const SLOT_ALIGNMENT = 8;

const FLORA_KINDS = Object.freeze({
  broadleaf: {
    family: "surface",
    role: "canopy",
    layer: "canopy",
    measuredDensestPage: 325,
    succession: 0.25,
    disturbance: 0.1,
    wetland: 0.45,
  },
  birch: {
    family: "surface",
    role: "canopy",
    layer: "canopy",
    measuredDensestPage: 154,
    succession: 1,
    disturbance: 1,
    wetland: 0.35,
  },
  "rainforest-canopy": {
    family: "surface",
    role: "canopy",
    layer: "canopy",
    measuredDensestPage: 192,
    succession: 0.35,
    disturbance: 0.25,
    wetland: 1,
  },
  conifer: {
    family: "surface",
    role: "canopy",
    layer: "canopy",
    measuredDensestPage: 464,
    succession: 0.15,
    disturbance: 0.2,
    wetland: 0.2,
    paletteShift: 0.07,
  },
  palm: {
    family: "surface",
    role: "canopy",
    layer: "canopy",
    measuredDensestPage: 197,
    succession: 0.65,
    disturbance: 0.2,
    wetland: 0.55,
  },
  "dead-tree": {
    family: "surface",
    role: "rigid",
    layer: "debris",
    measuredDensestPage: 64,
    succession: 0,
    disturbance: 0.55,
    wetland: 0.35,
  },
  shrub: {
    family: "surface",
    role: "understory",
    layer: "understory",
    measuredDensestPage: 378,
    succession: 1,
    disturbance: 1,
    wetland: 0.7,
  },
  cactus: {
    family: "surface",
    role: "rigid",
    layer: "understory",
    measuredDensestPage: 256,
    succession: 0.55,
    disturbance: 0,
    wetland: 0,
  },
  boulder: {
    family: "surface",
    role: "rigid",
    layer: "debris",
    measuredDensestPage: 288,
    succession: 0,
    disturbance: 0,
    wetland: 0.2,
  },
  mushroom: {
    family: "surface",
    role: "rigid",
    layer: "debris",
    measuredDensestPage: 42,
    succession: 0,
    disturbance: 1,
    wetland: 0.3,
  },
  "fallen-log": {
    family: "surface",
    role: "rigid",
    layer: "debris",
    measuredDensestPage: 69,
    succession: 0,
    disturbance: 0.85,
    wetland: 0.65,
  },
  "grass-tuft": {
    family: "surface",
    role: "groundcover",
    layer: "groundcover",
    measuredDensestPage: 378,
    succession: 0.85,
    disturbance: 0.9,
    wetland: 0.65,
  },
  fern: {
    family: "surface",
    role: "groundcover",
    layer: "groundcover",
    measuredDensestPage: 661,
    succession: 0.9,
    disturbance: 0.8,
    wetland: 0.9,
  },
  cycad: {
    family: "surface",
    role: "groundcover",
    layer: "groundcover",
    measuredDensestPage: 181,
    succession: 1,
    disturbance: 0.7,
    wetland: 1,
  },
  wildflower: {
    family: "surface",
    role: "groundcover",
    layer: "groundcover",
    measuredDensestPage: 213,
    succession: 0.95,
    disturbance: 1,
    wetland: 0.5,
  },
  glowcap: {
    family: "layer",
    role: "rigid",
    layer: "debris",
    measuredDensestPage: 218,
    anchor: "scatter",
  },
  "root-arch": {
    family: "layer",
    role: "rigid",
    layer: "understory",
    measuredDensestPage: 1301,
    anchor: "edge",
  },
  "bloom-coral": {
    family: "layer",
    role: "rigid",
    layer: "understory",
    measuredDensestPage: 128,
    anchor: "scatter",
  },
  "hollow-fern": {
    family: "layer",
    role: "groundcover",
    layer: "groundcover",
    measuredDensestPage: 288,
    anchor: "scatter",
  },
  "standing-stone": {
    family: "layer",
    role: "rigid",
    layer: "debris",
    measuredDensestPage: 469,
    anchor: "corner",
  },
  "drift-banner": {
    family: "layer",
    role: "understory",
    layer: "understory",
    measuredDensestPage: 106,
    anchor: "scatter",
  },
  "frost-tuft": {
    family: "layer",
    role: "groundcover",
    layer: "groundcover",
    measuredDensestPage: 592,
    anchor: "scatter",
  },
} as const satisfies Record<TerrainPropArchetypeId, FloraKind>);

const alignSlotCapacity = (measuredDensestPage: number): number =>
  Math.ceil((measuredDensestPage * SLOT_HEADROOM_MULTIPLIER) / SLOT_ALIGNMENT) * SLOT_ALIGNMENT;

export const TERRAIN_PROP_PAGE_SLOT_CAPACITY: Readonly<Record<TerrainPropArchetypeId, number>> = Object.freeze(
  Object.fromEntries(
    TERRAIN_PROP_ARCHETYPE_IDS.map((archetype) => [
      archetype,
      alignSlotCapacity(FLORA_KINDS[archetype].measuredDensestPage),
    ]),
  ) as Record<TerrainPropArchetypeId, number>,
);

export const TERRAIN_PROP_PALETTE_SHIFT: Readonly<Record<SurfacePropId, number>> = Object.freeze(
  Object.fromEntries(
    SURFACE_PROP_IDS.map((archetype) => {
      const kind = FLORA_KINDS[archetype];
      return [archetype, "paletteShift" in kind ? kind.paletteShift : DEFAULT_PALETTE_SHIFT];
    }),
  ) as Record<SurfacePropId, number>,
);

const FLORA_FOOTPRINT_RADIUS = Object.fromEntries(
  TERRAIN_PROP_ARCHETYPE_IDS.map((archetype) => [archetype, getFloraSpeciesMetadata(archetype).radius]),
) as Record<TerrainPropArchetypeId, number>;

const SPACING_SHARE: Readonly<Record<TerrainPropPlacementLayer, number>> = Object.freeze({
  canopy: 0.55,
  debris: 0.8,
  groundcover: 0,
  understory: 0.8,
});

function requireFloraKind(archetype: TerrainPropArchetypeId): FloraKind {
  const kind = FLORA_KINDS[archetype];
  if (!kind) throw new Error(`Unknown terrain prop archetype: ${archetype}`);
  return kind;
}

export function isLayerPropId(archetype: TerrainPropArchetypeId): archetype is LayerPropId {
  return requireFloraKind(archetype).family === "layer";
}

export function getLayerPropAnchor(archetype: LayerPropId): LayerPropAnchor {
  return FLORA_KINDS[archetype].anchor;
}

export function getTerrainPropRole(archetype: TerrainPropArchetypeId): TerrainPropRole {
  return requireFloraKind(archetype).role;
}

export function getTerrainPropPlacementLayer(archetype: TerrainPropArchetypeId): TerrainPropPlacementLayer {
  return requireFloraKind(archetype).layer;
}

export function getTerrainPropFootprintRadius(archetype: TerrainPropArchetypeId): number {
  return FLORA_FOOTPRINT_RADIUS[archetype];
}

export function getTerrainPropSpacingRadius(archetype: TerrainPropArchetypeId): number {
  return FLORA_FOOTPRINT_RADIUS[archetype] * SPACING_SHARE[getTerrainPropPlacementLayer(archetype)];
}

export function getTerrainPropSuccessionAffinity(archetype: SurfacePropId): number {
  return FLORA_KINDS[archetype].succession;
}

export function getTerrainPropDisturbanceAffinity(archetype: SurfacePropId): number {
  return FLORA_KINDS[archetype].disturbance;
}

export function getTerrainPropWetlandAffinity(archetype: SurfacePropId): number {
  return FLORA_KINDS[archetype].wetland;
}

export function isTerrainGroundCover(archetype: TerrainPropArchetypeId): boolean {
  return getTerrainPropRole(archetype) === "groundcover";
}

export function isTerrainPropVisibleAtLod(archetype: TerrainPropArchetypeId, lod: TerrainPropLod): boolean {
  return lod === "near" || !isTerrainGroundCover(archetype);
}
