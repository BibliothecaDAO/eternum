import clsx from "clsx";
import {
  BuildingType,
  BuildingTypeToString,
  getBuildingFromResource,
  getProducedResource,
  isEconomyBuilding,
  ResourcesIds,
} from "@bibliothecadao/types";
import Plus from "lucide-react/dist/esm/icons/plus";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";

// Paladins (Stable) → Knights (Barracks) → Crossbowmen (Archery). Player
// preference: heavier infantry / cavalry surface first in the military tab.
export const MILITARY_BUILDING_GROUP_ORDER = ["Stable", "Barracks", "Archery"] as const;

type MilitaryBuildingGroup = (typeof MILITARY_BUILDING_GROUP_ORDER)[number];

type RealmBuildingSummaryItem = {
  buildingId: BuildingType;
  label: string;
  iconResource: string;
  count: number;
};

type BuildRealmBuildingSummaryOptions = {
  realmResourceIds: ResourcesIds[];
  allowedBuildingTypes: BuildingType[];
  getBuildingCount: (buildingType: BuildingType) => number;
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

const toSummaryLabel = (buildingType: BuildingType) => BuildingTypeToString[buildingType] ?? "Building";

const toSummaryIconResource = (buildingType: BuildingType) => {
  if (buildingType === BuildingType.WorkersHut) return "House";
  if (buildingType === BuildingType.Storehouse) return "Silo";
  if (buildingType === BuildingType.ResourceDonkey) return "Donkey";

  const producedResource = getProducedResource(buildingType);
  if (producedResource !== undefined) {
    return ResourcesIds[producedResource];
  }

  return "House";
};

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
        iconResource: toSummaryIconResource(buildingType),
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
  variant = "section",
  buildActions,
}: {
  items: RealmBuildingSummaryItem[];
  className?: string;
  headline?: string;
  variant?: "section" | "card";
  buildActions?: Map<BuildingType, RealmBuildingSummaryBuildAction>;
}) => {
  const totalBuildings = items.reduce((total, item) => total + item.count, 0);
  const containerClassName =
    variant === "card" ? "rounded border border-gold/20 bg-black/50 p-2" : "border-b border-gold/10 px-3 py-2";

  return (
    <section className={clsx("realm-summary-selector", containerClassName, className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold/60">{headline}</p>
        <p className="text-[10px] text-gold/45">{totalBuildings > 0 ? `${totalBuildings} total` : "Empty realm"}</p>
      </div>

      {items.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((item) => {
            const buildAction = buildActions?.get(item.buildingId);
            const military = getMilitaryBuildingInfo(item.buildingId);

            return (
              <div
                key={item.buildingId}
                className={clsx(
                  "group relative flex items-center gap-1.5 rounded-full border border-gold/20 bg-brown/30 px-2 py-1 text-[11px] text-gold/90",
                  buildAction && "pr-8",
                )}
                title={item.label}
                aria-label={`${item.label}: ${item.count}`}
              >
                {military && (
                  <span className="rounded border border-gold/30 bg-black/40 px-1 text-[9px] font-semibold uppercase tracking-wide text-gold/80">
                    T{military.tier}
                  </span>
                )}
                <ResourceIcon resource={item.iconResource} size="xs" withTooltip={false} />
                <span className="font-semibold tabular-nums text-gold">{item.count}</span>
                {buildAction && (
                  <button
                    type="button"
                    onClick={buildAction.onBuild}
                    disabled={buildAction.disabled || buildAction.loading}
                    title={buildAction.title}
                    aria-label={`Build ${item.label}`}
                    className={clsx(
                      "absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-gold/40 bg-black/70 text-gold transition-opacity opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-gold",
                      !(buildAction.disabled || buildAction.loading) && "hover:bg-gold/15",
                      (buildAction.disabled || buildAction.loading) &&
                        "cursor-not-allowed opacity-40 group-hover:opacity-40",
                    )}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
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
