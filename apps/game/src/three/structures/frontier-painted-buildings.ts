import catalogue from "./frontier-painted-buildings.json";

export type FrontierPaintedGroup = "realms" | "farm" | "workshop" | "barracks" | "workers-hut" | "training" | "sites";

export interface FrontierPaintedBuilding {
  id: string;
  label: string;
  group: FrontierPaintedGroup;
  path: string;
  /** The baked architecture's triangle budget; the exporter decimates to it and the asset gate holds it. */
  architectureTriangles: number;
  /** The baked architecture atlas's width and height in pixels; map sites keep the outposts' smaller atlas. */
  atlasSize: number;
}

/**
 * The painted Frontier building set (models/frontier/painted/SOURCE.md): realm castles by level, the four tiered
 * buildings at tiers I to V, the training buildings and the map's sites, delivered for the board and map at game scale.
 */
export const FRONTIER_PAINTED_BUILDINGS = catalogue as readonly FrontierPaintedBuilding[];

export const FRONTIER_PAINTED_GROUPS: readonly { group: FrontierPaintedGroup; label: string }[] = [
  { group: "realms", label: "Realm castles" },
  { group: "farm", label: "Farm I–V" },
  { group: "workshop", label: "Workshop I–V" },
  { group: "barracks", label: "Barracks I–V" },
  { group: "workers-hut", label: "Workers' hut I–V" },
  { group: "training", label: "Training buildings" },
  { group: "sites", label: "Map sites" },
];
