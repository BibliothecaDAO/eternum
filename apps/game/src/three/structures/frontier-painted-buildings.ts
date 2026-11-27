import catalogue from "./frontier-painted-buildings.json";
import { BuildingType } from "@bibliothecadao/types";
import type { RealmBuildingFamily } from "./realm-building-kit";
import { REALM_SUPPORT_PATHS } from "./realm-support-kit";

export type FrontierPaintedGroup = "realms" | "farm" | "workshop" | "barracks" | "training" | "sites";

interface FrontierPaintedBuilding {
  id: string;
  label: string;
  group: FrontierPaintedGroup;
  path: string;
  architectureTriangles: number;
  atlasSize: number;
}

type FrontierBuildingModelSpec =
  | { readonly kind: "tiered"; readonly family: RealmBuildingFamily }
  | { readonly kind: "model"; readonly path: string };

export const FRONTIER_PAINTED_BUILDINGS = catalogue as readonly FrontierPaintedBuilding[];

export function frontierPaintedPath(id: string): string {
  const building = FRONTIER_PAINTED_BUILDINGS.find((entry) => entry.id === id);
  if (!building) throw new Error(`Unknown painted Frontier building: ${id}`);
  return building.path;
}

export const FRONTIER_PAINTED_REALMS = ["settlement", "city", "kingdom", "empire"].map(frontierPaintedPath);

const FRONTIER_BUILDING_MODELS = {
  [BuildingType.None]: null,
  [BuildingType.WorkersHut]: null,
  [BuildingType.Storehouse]: { kind: "model", path: REALM_SUPPORT_PATHS.storeroom },
  [BuildingType.ResourceStone]: null,
  [BuildingType.ResourceCoal]: null,
  [BuildingType.ResourceWood]: null,
  [BuildingType.ResourceCopper]: null,
  [BuildingType.ResourceIronwood]: null,
  [BuildingType.ResourceObsidian]: null,
  [BuildingType.ResourceGold]: null,
  [BuildingType.ResourceSilver]: null,
  [BuildingType.ResourceMithral]: null,
  [BuildingType.ResourceAlchemicalSilver]: null,
  [BuildingType.ResourceColdIron]: null,
  [BuildingType.ResourceDeepCrystal]: null,
  [BuildingType.ResourceRuby]: null,
  [BuildingType.ResourceDiamonds]: null,
  [BuildingType.ResourceHartwood]: null,
  [BuildingType.ResourceIgnium]: null,
  [BuildingType.ResourceTwilightQuartz]: null,
  [BuildingType.ResourceTrueIce]: null,
  [BuildingType.ResourceAdamantine]: null,
  [BuildingType.ResourceSapphire]: null,
  [BuildingType.ResourceEtherealSilica]: null,
  [BuildingType.ResourceDragonhide]: null,
  [BuildingType.ResourceLabor]: { kind: "tiered", family: "workshop" },
  [BuildingType.ResourceAncientFragment]: null,
  [BuildingType.ResourceDonkey]: null,
  [BuildingType.ResourceKnightT1]: { kind: "tiered", family: "barracks" },
  [BuildingType.ResourceKnightT2]: null,
  [BuildingType.ResourceKnightT3]: null,
  [BuildingType.ResourceCrossbowmanT1]: { kind: "model", path: REALM_SUPPORT_PATHS["crossbow-range"] },
  [BuildingType.ResourceCrossbowmanT2]: null,
  [BuildingType.ResourceCrossbowmanT3]: null,
  [BuildingType.ResourcePaladinT1]: null,
  [BuildingType.ResourcePaladinT2]: null,
  [BuildingType.ResourcePaladinT3]: null,
  [BuildingType.ResourceWheat]: { kind: "tiered", family: "farm" },
  [BuildingType.ResourceFish]: null,
  [BuildingType.ResourceEssence]: null,
  [BuildingType.ResourceResearch]: null,
  [BuildingType.RationsDepot]: { kind: "model", path: REALM_SUPPORT_PATHS["rations-depot"] },
  [BuildingType.SupplyYard]: { kind: "model", path: REALM_SUPPORT_PATHS["supply-yard"] },
  [BuildingType.ScoutsLodge]: { kind: "model", path: REALM_SUPPORT_PATHS["scouts-lodge"] },
  [BuildingType.ConscriptionCamp]: { kind: "model", path: REALM_SUPPORT_PATHS.camp },
} as const satisfies Record<BuildingType, FrontierBuildingModelSpec | null>;

export function frontierPaintedBuildingPath(type: BuildingType, tier = 1): string | undefined {
  const spec = FRONTIER_BUILDING_MODELS[type];
  if (!spec) return undefined;
  if (spec.kind === "model") return spec.path;
  return frontierPaintedPath(`${spec.family}-${tier}`);
}

export function tieredBuildingFamily(type: BuildingType): RealmBuildingFamily | undefined {
  const spec = FRONTIER_BUILDING_MODELS[type];
  return spec?.kind === "tiered" ? spec.family : undefined;
}

export const FRONTIER_PAINTED_GROUPS: readonly { group: FrontierPaintedGroup; label: string }[] = [
  { group: "realms", label: "Realm castles" },
  { group: "farm", label: "Farm I–V" },
  { group: "workshop", label: "Workshop I–V" },
  { group: "barracks", label: "Barracks I–V" },
  { group: "training", label: "Training buildings" },
  { group: "sites", label: "Map sites" },
];
