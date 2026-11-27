import { BuildingType, structureName, StructureType } from "@bibliothecadao/types";
import { MAP_SITES } from "@/config/map-sites";
import { SPIRE, SUPPLY_POST } from "@/ui/design-system/kit/words";
import { buildingModelPaths, BUILDINGS_GROUPS, CAMP_MODEL_PATH, RiftModelPath } from "../../constants/scene-constants";
import { buildingTierModelPath } from "../../structures/building-tiers";
import {
  FRONTIER_PAINTED_BUILDINGS,
  FRONTIER_PAINTED_GROUPS,
  type FrontierPaintedGroup,
} from "../../structures/frontier-painted-buildings";
import { OUTPOST_PATHS } from "../../structures/outpost-kit";
import { realmSupportLabEntries } from "../../structures/realm-support-kit";
import { RUIN_VARIANTS, ruinKitPath } from "../../structures/ruin-kit";
import { SPIRE_MODEL_PATH } from "../../structures/spire-kit";
import { WELL_SHRINE_PATHS } from "../../structures/well-shrine-kit";
import { mountStaticLineup, type LineupAsset, type LineupSettings } from "./static-model-lineup";

const PROCEDURAL_LANDMARK_GROUPS = [
  { group: "wells-shrines", label: MAP_SITES.map(({ kind }) => kind).join(" & ") },
  { group: "ruins", label: structureName(StructureType.Ruin) },
  { group: "outposts", label: "Outposts" },
  { group: "spire", label: SPIRE },
] as const;

type ProceduralLandmarkGroup = (typeof PROCEDURAL_LANDMARK_GROUPS)[number]["group"];
export type FrontierLabGroup = FrontierPaintedGroup | ProceduralLandmarkGroup;

export const FRONTIER_LAB_GROUPS: readonly { readonly group: FrontierLabGroup; readonly label: string }[] = [
  ...FRONTIER_PAINTED_GROUPS,
  ...PROCEDURAL_LANDMARK_GROUPS,
];

export interface FrontierPaintedLabSettings {
  group: FrontierLabGroup;
  compare: boolean;
  shipped: boolean;
  camera: "board" | "worldmap";
  focus: number | null;
  distance: number;
  yaw: number;
  lighting: "day" | "sunset";
}

const SLOT_SPACING = Math.sqrt(3) * 1.5;
const SHIPPED_ROW_Z = -2.8;
const BOARD_TYPES: Partial<Record<string, BuildingType>> = {
  farm: BuildingType.ResourceWheat,
  workshop: BuildingType.ResourceLabor,
  barracks: BuildingType.ResourceKnightT1,
  "supply-yard": BuildingType.SupplyYard,
  "scouts-lodge": BuildingType.ScoutsLodge,
};
const SHIPPED_SITES: Partial<Record<string, string>> = {
  camp: CAMP_MODEL_PATH,
  "essence-rift": RiftModelPath,
};

interface LabBuildingEntry {
  readonly id: string;
  readonly label: string;
  readonly group: FrontierLabGroup;
  readonly path: string;
  readonly shippedPath?: string;
}

type OutpostLabKind = keyof typeof OUTPOST_PATHS;

const OUTPOST_LAB_LABELS = {
  village: () => structureName(StructureType.Village),
  camp: () => structureName(StructureType.Camp),
  "cleared-standard": () => SUPPLY_POST.title,
} as const satisfies Record<OutpostLabKind, () => string>;

const PROCEDURAL_LANDMARK_BUILDERS: Record<ProceduralLandmarkGroup, () => readonly LabBuildingEntry[]> = {
  "wells-shrines": () =>
    MAP_SITES.map(({ kind }) => ({
      id: kind.toLowerCase(),
      label: kind,
      group: "wells-shrines",
      path: WELL_SHRINE_PATHS[kind],
      shippedPath: WELL_SHRINE_PATHS[kind],
    })),
  ruins: () => {
    const ruinName = structureName(StructureType.Ruin);
    return RUIN_VARIANTS.map((variant) => {
      const path = ruinKitPath(variant);
      return {
        id: `ruin-${variant}`,
        label: `${ruinName} ${variant + 1}`,
        group: "ruins",
        path,
        shippedPath: path,
      };
    });
  },
  outposts: () =>
    (Object.keys(OUTPOST_PATHS) as OutpostLabKind[]).map((id) => ({
      id,
      label: OUTPOST_LAB_LABELS[id](),
      group: "outposts",
      path: OUTPOST_PATHS[id],
      shippedPath: OUTPOST_PATHS[id],
    })),
  spire: () => [
    {
      id: "spire",
      label: SPIRE,
      group: "spire",
      path: SPIRE_MODEL_PATH,
      shippedPath: SPIRE_MODEL_PATH,
    },
  ],
};

export function frontierLabEntries(group: FrontierLabGroup): readonly LabBuildingEntry[] {
  const allBuildings: readonly LabBuildingEntry[] = [
    ...FRONTIER_PAINTED_BUILDINGS,
    ...realmSupportLabEntries(),
    ...PROCEDURAL_LANDMARK_GROUPS.flatMap(({ group: landmarkGroup }) => PROCEDURAL_LANDMARK_BUILDERS[landmarkGroup]()),
  ];
  return allBuildings.filter((building) => building.group === group);
}

export function resolveFrontierLabShippedPath(building: LabBuildingEntry): string | undefined {
  if (building.shippedPath) return building.shippedPath;
  if (building.group === "sites") return SHIPPED_SITES[building.id];
  const [kind, tier] = splitTier(building.id);
  const type = BOARD_TYPES[kind];
  if (type === undefined) return undefined;
  const tiered = buildingTierModelPath(type, tier);
  if (tiered) return tiered;
  const boardPaths: Partial<Record<BuildingType, string>> = buildingModelPaths()[BUILDINGS_GROUPS.BUILDINGS];
  return boardPaths[type];
}

export async function mountFrontierPaintedLab(
  container: HTMLElement,
  settings: FrontierPaintedLabSettings,
  signal: AbortSignal,
) {
  const set = frontierLabEntries(settings.group);
  const lineup = settings.shipped
    ? placeShippedRow(set, 0)
    : settings.compare
      ? [...placeRow(set, 0), ...placeShippedRow(set)]
      : placeRow(set, 0);
  const toLineup = (value: FrontierPaintedLabSettings): LineupSettings => ({
    distance: value.distance,
    focus: value.focus ?? "lineup",
    yaw: value.yaw,
    lighting: value.lighting,
    camera: value.camera === "worldmap" ? "worldmap" : undefined,
  });
  const mounted = await mountStaticLineup(container, toLineup(settings), signal, lineup);
  return {
    assets: mounted.assets,
    update: (value: FrontierPaintedLabSettings) => mounted.update(toLineup(value)),
    dispose: mounted.dispose,
  };
}

function placeRow(buildings: readonly LabBuildingEntry[], z: number): LineupAsset[] {
  return buildings.map((building, slot) => ({
    label: building.label,
    position: { x: slotX(slot, buildings.length), z },
    parts: [{ path: building.path }],
  }));
}

function placeShippedRow(buildings: readonly LabBuildingEntry[], z = SHIPPED_ROW_Z): LineupAsset[] {
  return buildings.map((building, slot) => {
    const path = resolveFrontierLabShippedPath(building);
    return {
      label: z === 0 ? `${building.label}${path ? "" : " · no shipped model"}` : "",
      position: { x: slotX(slot, buildings.length), z },
      parts: path ? [{ path }] : [],
    };
  });
}

function slotX(slot: number, count: number): number {
  return (slot - (count - 1) / 2) * SLOT_SPACING;
}

function splitTier(id: string): [string, number] {
  const match = /^(.*)-(\d)$/.exec(id);
  return match ? [match[1], Number(match[2])] : [id, 1];
}
