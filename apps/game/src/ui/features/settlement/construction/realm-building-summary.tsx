import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudChip, HudIconButton, HudTierChip } from "@/ui/design-system/kit/hud-elements";
import {
  BuildingType,
  buildingName,
  getBuildingFromResource,
  isEconomyBuilding,
  ResourcesIds,
} from "@bibliothecadao/types";

import { buildingMeaning } from "@/ui/design-system/domain-icon-meaning";
import { type IconMeaning } from "@/ui/design-system/icon-meaning";

// Paladins (Stable) → Knights (Barracks) → Crossbowmen (Archery). Player
// preference: heavier infantry / cavalry surface first in the military tab.
export const MILITARY_BUILDING_GROUP_ORDER = ["Stable", "Barracks", "Archery"] as const;

export type MilitaryBuildingGroup = (typeof MILITARY_BUILDING_GROUP_ORDER)[number];

type RealmBuildingSummaryItem = {
  buildingId: BuildingType;
  label: string;
  icon: IconMeaning;
  count: number;
};

type BuildRealmBuildingSummaryOptions = {
  realmResourceIds: ResourcesIds[];
  allowedBuildingTypes: BuildingType[];
  getBuildingCount: (buildingType: BuildingType) => number;
  /** Whether the realm plays Frontier, which names its own buildings (buildingName). */
  frontier: boolean;
};

type RealmBuildingSummaryBuildAction = {
  onBuild: () => void;
  disabled?: boolean;
  loading?: boolean;
  title?: string;
};

const prioritizeEconomicBuilding = (buildingType: BuildingType) => {
  if (buildingType === BuildingType.ResourceWheat) return -2;
  if (buildingType === BuildingType.ResourceFish) return -1;
  return 0;
};

const dedupeBuildingTypes = (buildingTypes: BuildingType[]) => {
  const seen = new Set<BuildingType>();
  return buildingTypes.filter((buildingType) => {
    if (seen.has(buildingType)) return false;
    seen.add(buildingType);
    return true;
  });
};

const resolveResourceBuildingTypes = (realmResourceIds: ResourcesIds[]) =>
  dedupeBuildingTypes(
    realmResourceIds
      .map((resourceId) => getBuildingFromResource(resourceId))
      .filter((buildingType): buildingType is BuildingType => buildingType !== BuildingType.None),
  );

const resolveEconomicBuildingTypes = (allowedBuildingTypes: BuildingType[]) =>
  allowedBuildingTypes
    .filter((buildingType) => isEconomyBuilding(buildingType))
    .toSorted((left, right) => prioritizeEconomicBuilding(left) - prioritizeEconomicBuilding(right));

const resolveMilitaryBuildingTypes = (allowedBuildingTypes: BuildingType[]) =>
  MILITARY_BUILDING_GROUP_ORDER.flatMap((group) =>
    allowedBuildingTypes
      .filter((buildingType) => getMilitaryBuildingInfo(buildingType)?.type === group)
      .toSorted(
        (left, right) => (getMilitaryBuildingInfo(left)?.tier ?? 0) - (getMilitaryBuildingInfo(right)?.tier ?? 0),
      ),
  );

const resolveRealmBuildingSummaryOrder = (realmResourceIds: ResourcesIds[], allowedBuildingTypes: BuildingType[]) =>
  dedupeBuildingTypes([
    ...resolveResourceBuildingTypes(realmResourceIds),
    ...resolveEconomicBuildingTypes(allowedBuildingTypes),
    ...resolveMilitaryBuildingTypes(allowedBuildingTypes),
  ]);

export const buildRealmBuildingSummary = ({
  realmResourceIds,
  allowedBuildingTypes,
  getBuildingCount,
  frontier,
}: BuildRealmBuildingSummaryOptions): RealmBuildingSummaryItem[] =>
  resolveRealmBuildingSummaryOrder(realmResourceIds, allowedBuildingTypes).reduce<RealmBuildingSummaryItem[]>(
    (items, buildingType) => {
      const count = getBuildingCount(buildingType);
      if (count <= 0) return items;

      items.push({
        buildingId: buildingType,
        label: buildingName(buildingType, frontier),
        icon: buildingMeaning(buildingType, frontier),
        count,
      });
      return items;
    },
    [],
  );

/** What stands in the realm, a chip per building with its count and, where it can be built again, its "+". */
export const RealmBuildingSummary = ({
  items,
  headline = "Built here",
  buildActions,
}: {
  items: RealmBuildingSummaryItem[];
  headline?: string;
  buildActions?: Map<BuildingType, RealmBuildingSummaryBuildAction>;
}) => {
  const totalBuildings = items.reduce((total, item) => total + item.count, 0);

  return (
    <section className="flex flex-col gap-2 border-b border-hud-divider py-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-hud-label text-hud-muted">{headline}</p>
        <p className="text-hud-label text-hud-cue">{totalBuildings > 0 ? `${totalBuildings} total` : "Empty realm"}</p>
      </div>

      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => {
            const buildAction = buildActions?.get(item.buildingId);
            const military = getMilitaryBuildingInfo(item.buildingId);

            return (
              <span
                key={item.buildingId}
                className="flex items-center gap-1"
                title={item.label}
                aria-label={`${item.label}: ${item.count}`}
              >
                <HudChip>
                  <span className="inline-flex items-center gap-1.5">
                    {military && <HudTierChip tier={military.tier as 1 | 2 | 3} />}
                    <SemanticIcon name={item.icon} size={16} className="h-4 w-4" />
                    <span className="tabular-nums">{item.count}</span>
                  </span>
                </HudChip>
                {buildAction && (
                  <HudIconButton
                    icon="plus"
                    label={`Build ${item.label}`}
                    title={buildAction.title}
                    kind="quiet"
                    size="sm"
                    aria-busy={buildAction.loading || undefined}
                    disabled={buildAction.disabled || buildAction.loading}
                    onClick={buildAction.onBuild}
                  />
                )}
              </span>
            );
          })}
        </div>
      ) : (
        <p className="text-hud-label italic text-hud-muted">No buildings yet.</p>
      )}
    </section>
  );
};

export const getMilitaryBuildingInfo = (
  buildingType: BuildingType,
): { type: MilitaryBuildingGroup; tier: number } | null => {
  if (buildingType === BuildingType.ResourceCrossbowmanT1) return { type: "Archery", tier: 1 };
  if (buildingType === BuildingType.ResourceCrossbowmanT2) return { type: "Archery", tier: 2 };
  if (buildingType === BuildingType.ResourceCrossbowmanT3) return { type: "Archery", tier: 3 };

  if (buildingType === BuildingType.ResourcePaladinT1) return { type: "Stable", tier: 1 };
  if (buildingType === BuildingType.ResourcePaladinT2) return { type: "Stable", tier: 2 };
  if (buildingType === BuildingType.ResourcePaladinT3) return { type: "Stable", tier: 3 };

  if (buildingType === BuildingType.ResourceKnightT1) return { type: "Barracks", tier: 1 };
  if (buildingType === BuildingType.ResourceKnightT2) return { type: "Barracks", tier: 2 };
  if (buildingType === BuildingType.ResourceKnightT3) return { type: "Barracks", tier: 3 };

  return null;
};
