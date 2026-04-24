import clsx from "clsx";
import {
  BuildingType,
  BuildingTypeToString,
  getBuildingFromResource,
  isEconomyBuilding,
  ResourcesIds,
} from "@bibliothecadao/types";

export const MILITARY_BUILDING_GROUP_ORDER = ["Archery", "Stable", "Barracks"] as const;

type MilitaryBuildingGroup = (typeof MILITARY_BUILDING_GROUP_ORDER)[number];

type RealmBuildingSummaryItem = {
  buildingId: BuildingType;
  label: string;
  count: number;
};

type BuildRealmBuildingSummaryOptions = {
  realmResourceIds: ResourcesIds[];
  allowedBuildingTypes: BuildingType[];
  getBuildingCount: (buildingType: BuildingType) => number;
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

const toSummaryLabel = (buildingType: BuildingType) => BuildingTypeToString[buildingType] ?? "Building";

export const buildRealmBuildingSummary = ({
  realmResourceIds,
  allowedBuildingTypes,
  getBuildingCount,
}: BuildRealmBuildingSummaryOptions): RealmBuildingSummaryItem[] =>
  resolveRealmBuildingSummaryOrder(realmResourceIds, allowedBuildingTypes).reduce<RealmBuildingSummaryItem[]>(
    (items, buildingType) => {
      const count = getBuildingCount(buildingType);
      if (count <= 0) return items;

      items.push({
        buildingId: buildingType,
        label: toSummaryLabel(buildingType),
        count,
      });
      return items;
    },
    [],
  );

export const RealmBuildingSummary = ({
  items,
  className,
  headline = "Built here",
}: {
  items: RealmBuildingSummaryItem[];
  className?: string;
  headline?: string;
}) => {
  const totalBuildings = items.reduce((total, item) => total + item.count, 0);

  return (
    <section className={clsx("realm-summary-selector border-b border-gold/10 px-3 py-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold/60">{headline}</p>
        <p className="text-[10px] text-gold/45">{totalBuildings > 0 ? `${totalBuildings} total` : "Empty realm"}</p>
      </div>

      {items.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((item) => (
            <div
              key={item.buildingId}
              className="flex items-center gap-1.5 rounded-full border border-gold/20 bg-brown/30 px-2 py-1 text-[11px] text-gold/90"
            >
              <span className="max-w-[8rem] truncate">{item.label}</span>
              <span className="rounded-full bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold text-gold">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs italic text-gold/55">No buildings yet.</p>
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
