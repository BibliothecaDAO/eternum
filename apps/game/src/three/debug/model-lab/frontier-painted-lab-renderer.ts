import { BuildingType } from "@bibliothecadao/types";
import {
  buildingModelPaths,
  BUILDINGS_GROUPS,
  CAMP_MODEL_PATH,
  REALM_MODEL_PATHS,
} from "../../constants/scene-constants";
import { buildingTierModelPath } from "../../structures/building-tiers";
import { FALLEN_REALM_RUIN_PATH } from "../../structures/frontier-beast";
import {
  FRONTIER_PAINTED_BUILDINGS,
  type FrontierPaintedBuilding,
  type FrontierPaintedGroup,
} from "../../structures/frontier-painted-buildings";
import { mountStaticLineup, type LineupAsset, type LineupSettings } from "./static-model-lineup";

export interface FrontierPaintedLabSettings {
  group: FrontierPaintedGroup;
  compare: boolean;
  /** One building of the set to look at closely, by its place in the set; the whole row otherwise. */
  focus: number | null;
  distance: number;
  yaw: number;
  lighting: "day" | "sunset";
}

const SLOT_SPACING = Math.sqrt(3) * 1.5;
const SHIPPED_ROW_Z = -2.8;
const SHIPPED_TIER_LIMIT = 3;
const BOARD_TYPES: Partial<Record<string, BuildingType>> = {
  farm: BuildingType.ResourceWheat,
  workshop: BuildingType.ResourceLabor,
  barracks: BuildingType.ResourceKnightT1,
  "workers-hut": BuildingType.WorkersHut,
  "war-hall": BuildingType.WarHall,
  "supply-yard": BuildingType.SupplyYard,
  "scouts-lodge": BuildingType.ScoutsLodge,
  hearth: BuildingType.Hearth,
};
const SHIPPED_SITES: Partial<Record<string, string>> = {
  camp: CAMP_MODEL_PATH,
  "fallen-realm-ruin": FALLEN_REALM_RUIN_PATH,
  shrine: "/models/outposts/shrine.glb",
  well: "/models/outposts/well.glb",
  "essence-rift": "/models/reward-tiles/rift.glb",
};

/** One painted set at game scale, optionally with the shipped models it would replace in a row behind it. */
export async function mountFrontierPaintedLab(
  container: HTMLElement,
  settings: FrontierPaintedLabSettings,
  signal: AbortSignal,
) {
  const set = FRONTIER_PAINTED_BUILDINGS.filter((building) => building.group === settings.group);
  const lineup = settings.compare ? [...placeRow(set, 0), ...placeShippedRow(set)] : placeRow(set, 0);
  const toLineup = (value: FrontierPaintedLabSettings): LineupSettings => ({
    distance: value.distance,
    focus: value.focus ?? "lineup",
    yaw: value.yaw,
    lighting: value.lighting,
  });
  const mounted = await mountStaticLineup(container, toLineup(settings), signal, lineup);
  return {
    assets: mounted.assets,
    update: (value: FrontierPaintedLabSettings) => mounted.update(toLineup(value)),
    dispose: mounted.dispose,
  };
}

function placeRow(buildings: readonly FrontierPaintedBuilding[], z: number): LineupAsset[] {
  return buildings.map((building, slot) => ({
    label: building.label,
    position: { x: slotX(slot, buildings.length), z },
    parts: [{ path: building.path }],
  }));
}

function placeShippedRow(buildings: readonly FrontierPaintedBuilding[]): LineupAsset[] {
  return buildings.flatMap((building, slot) => {
    const path = resolveShippedPath(building);
    if (!path) return [];
    return [{ label: "", position: { x: slotX(slot, buildings.length), z: SHIPPED_ROW_Z }, parts: [{ path }] }];
  });
}

function slotX(slot: number, count: number): number {
  return (slot - (count - 1) / 2) * SLOT_SPACING;
}

/** The model the game draws today where this painted building would stand. */
function resolveShippedPath(building: FrontierPaintedBuilding): string | undefined {
  if (building.group === "realms") return REALM_MODEL_PATHS[realmLevelName(building.id)];
  if (building.group === "sites") return SHIPPED_SITES[building.id];
  const [kind, tier] = splitTier(building.id);
  const type = BOARD_TYPES[kind];
  if (type === undefined) return undefined;
  const tiered = buildingTierModelPath(type, tier);
  // models/frontier/buildings ships tiers II and III only; higher tiers have no model to compare with yet.
  if (tiered) return tier <= SHIPPED_TIER_LIMIT ? tiered : undefined;
  const boardPaths: Partial<Record<BuildingType, string>> = buildingModelPaths()[BUILDINGS_GROUPS.BUILDINGS];
  return boardPaths[type];
}

function splitTier(id: string): [string, number] {
  const match = /^(.*)-(\d)$/.exec(id);
  return match ? [match[1], Number(match[2])] : [id, 1];
}

function realmLevelName(id: string): keyof typeof REALM_MODEL_PATHS {
  const name = (id.charAt(0).toUpperCase() + id.slice(1)) as keyof typeof REALM_MODEL_PATHS;
  if (!(name in REALM_MODEL_PATHS)) throw new Error(`No shipped realm model for ${id}`);
  return name;
}
