import { getIsBlitz } from "@bibliothecadao/eternum";

import { getBlockTimestamp } from "@bibliothecadao/eternum";

import {
  configManager,
  getEntityIdFromKeys,
  getStructureName,
  getStructureRelicEffects,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { useBuildings, useDojo } from "@bibliothecadao/react";
import { getProducedResource, ID, RealmInfo, ResourcesIds } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { HasValue, runQuery } from "@dojoengine/recs";
import clsx from "clsx";
import { SparklesIcon } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { ProductionStatusBadge } from "@/ui/shared";
import { formatTimeRemaining } from "../../economy/resources/entity-resource-table/utils";

interface ProductionSidebarProps {
  realms: RealmInfo[];
  selectedRealmEntityId: ID;
  onSelectRealm: (id: ID) => void;
  onSelectResource: (realmId: ID, resource: ResourcesIds) => void;
}

interface ResourceProductionSummaryItem {
  resourceId: ResourcesIds;
  totalBuildings: number;
  activeBuildings: number;
  isProducing: boolean;
  timeRemainingSeconds: number | null;
  productionPerSecond: number | null;
  outputRemaining: number | null;
  calculatedAt: number;
}

const SidebarRealm = ({
  realm,
  isSelected,
  onSelect,
  onSelectResource,
}: {
  realm: RealmInfo;
  isSelected: boolean;
  onSelect: () => void;
  onSelectResource: (realmId: ID, resource: ResourcesIds) => void;
}) => {
  const {
    setup: {
      components: { Building, Resource, ProductionBoostBonus },
    },
  } = useDojo();

  const [timerTick, setTimerTick] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const interval = window.setInterval(() => {
      setTimerTick((tick) => tick + 1);
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const currentTime = useMemo(() => Date.now(), [timerTick]);

  const buildings = useMemo(() => {
    const buildings = runQuery([
      HasValue(Building, {
        outer_entity_id: realm.entityId,
      }),
    ]);

    return buildings;
  }, [realm]);

  // Get production data
  const resourceData = useComponentValue(Resource, getEntityIdFromKeys([BigInt(realm.entityId)]));

  const { currentDefaultTick } = getBlockTimestamp();

  const buildingsData = useBuildings(realm.position.x, realm.position.y);
  const productionBuildings = useMemo(
    () => buildingsData.filter((building) => building && getProducedResource(building.category)),
    [buildingsData],
  );

  const resourceProductionSummary = useMemo<ResourceProductionSummaryItem[]>(() => {
    const summaries = new Map<ResourcesIds, { totalBuildings: number }>();

    productionBuildings.forEach((building) => {
      if (!building?.produced?.resource) return;

      const resourceId = building.produced.resource as ResourcesIds;
      if (resourceId === ResourcesIds.Labor) return;

      const summary = summaries.get(resourceId);
      if (summary) {
        summary.totalBuildings += 1;
      } else {
        summaries.set(resourceId, { totalBuildings: 1 });
      }
    });

    const calculatedAt = Date.now();

    return Array.from(summaries.entries()).map(([resourceId, stats]) => {
      let isProducing = false;
      let timeRemainingSeconds: number | null = null;
      let productionPerSecond: number | null = null;
      let outputRemaining: number | null = null;
      let activeBuildings = 0;

      if (resourceData) {
        const productionInfo = ResourceManager.balanceAndProduction(resourceData, resourceId);
        const productionData = ResourceManager.calculateResourceProductionData(
          resourceId,
          productionInfo,
          currentDefaultTick || 0,
        );
        isProducing = productionData.isProducing;
        if (isProducing) {
          const buildingCount = productionInfo.production.building_count;
          activeBuildings = buildingCount > 0 ? buildingCount : stats.totalBuildings;
        }

        timeRemainingSeconds = Number.isFinite(productionData.timeRemainingSeconds)
          ? productionData.timeRemainingSeconds
          : null;
        productionPerSecond = Number.isFinite(productionData.productionPerSecond)
          ? productionData.productionPerSecond
          : null;
        outputRemaining = Number.isFinite(productionData.outputRemaining) ? productionData.outputRemaining : null;
      }

      return {
        resourceId,
        totalBuildings: stats.totalBuildings,
        activeBuildings,
        isProducing,
        timeRemainingSeconds,
        productionPerSecond,
        outputRemaining,
        calculatedAt,
      };
    });
  }, [productionBuildings, resourceData, currentDefaultTick]);

  const totalProductionBuildings = resourceProductionSummary.reduce(
    (accumulator, summary) => accumulator + summary.totalBuildings,
    0,
  );
  const activeProductionBuildings = resourceProductionSummary.reduce(
    (accumulator, summary) => accumulator + summary.activeBuildings,
    0,
  );
  const hasProduction = resourceProductionSummary.length > 0;

  // Get bonuses
  const productionBoostBonus = useComponentValue(ProductionBoostBonus, getEntityIdFromKeys([BigInt(realm.entityId)]));

  const { wonderBonus, hasActivatedWonderBonus } = useMemo(() => {
    const wonderBonusConfig = configManager.getWonderBonusConfig();
    const hasActivatedWonderBonus = productionBoostBonus && productionBoostBonus.wonder_incr_percent_num > 0;
    return {
      wonderBonus: hasActivatedWonderBonus ? 1 + wonderBonusConfig.bonusPercentNum / 10000 : 1,
      hasActivatedWonderBonus,
    };
  }, [productionBoostBonus]);

  const activeRelics = useMemo(() => {
    if (!productionBoostBonus) return [];
    return getStructureRelicEffects(productionBoostBonus, getBlockTimestamp().currentArmiesTick);
  }, [productionBoostBonus]);

  return (
    <div
      className={clsx(
        "rounded-lg panel-wood transition-all cursor-pointer border border-transparent",
        "px-3 py-2",
        isSelected ? "border-gold/70 bg-gold/5 shadow-[0_0_18px_rgba(255,204,102,0.45)]" : "hover:bg-gold/5",
      )}
      onClick={onSelect}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-gold">{getStructureName(realm.structure, getIsBlitz()).name}</h3>
            <p className="text-xs text-gold/60">
              {hasProduction
                ? `${buildings.size} buildings • ${activeProductionBuildings}/${totalProductionBuildings} producing`
                : `${buildings.size} buildings • no production`}
            </p>
          </div>
          {(hasActivatedWonderBonus || activeRelics.length > 0) && (
            <div className="flex gap-1 shrink-0">
              {hasActivatedWonderBonus && (
                <div
                  className="bg-gold/20 p-1 rounded"
                  title={`Wonder Bonus: +${((wonderBonus - 1) * 100).toFixed(2)}%`}
                >
                  <SparklesIcon className="w-4 h-4 text-gold" />
                </div>
              )}
              {activeRelics.length > 0 && (
                <div className="bg-relic-activated/20 p-1 rounded" title={`${activeRelics.length} Active Relics`}>
                  <span className="text-xs font-bold text-relic-activated">{activeRelics.length}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasProduction ? (
            resourceProductionSummary.map((summary) => {
              const resourceLabel = ResourcesIds[summary.resourceId];
              const elapsedSeconds = (currentTime - summary.calculatedAt) / 1000;
              const effectiveRemainingSeconds =
                summary.timeRemainingSeconds !== null
                  ? Math.max(summary.timeRemainingSeconds - elapsedSeconds, 0)
                  : null;
              const formattedRemaining =
                summary.isProducing && effectiveRemainingSeconds !== null
                  ? formatTimeRemaining(Math.ceil(effectiveRemainingSeconds))
                  : null;
              const tooltipParts = summary.isProducing
                ? [
                    resourceLabel,
                    `${summary.activeBuildings}/${summary.totalBuildings} producing`,
                    formattedRemaining ? `${formattedRemaining} left` : null,
                  ]
                : [
                    resourceLabel,
                    `Idle (${summary.totalBuildings} building${summary.totalBuildings !== 1 ? "s" : ""})`,
                  ];

              return (
                <ProductionStatusBadge
                  key={summary.resourceId}
                  resourceLabel={resourceLabel}
                  tooltipText={tooltipParts.filter(Boolean).join(" • ")}
                  isProducing={summary.isProducing}
                  timeRemainingSeconds={effectiveRemainingSeconds}
                  totalCount={summary.totalBuildings}
                  size="sm"
                  onClick={() => onSelectResource(realm.entityId, summary.resourceId)}
                />
              );
            })
          ) : (
            <span className="text-xs text-gold/60">No production buildings</span>
          )}
        </div>
      </div>
    </div>
  );
};

export const ProductionSidebar = memo(
  ({ realms, selectedRealmEntityId, onSelectRealm, onSelectResource }: ProductionSidebarProps) => {
    return (
      <div className="space-y-4">
        {realms.map((realm) => (
          <SidebarRealm
            key={realm.entityId}
            realm={realm}
            isSelected={realm.entityId === selectedRealmEntityId}
            onSelect={() => onSelectRealm(realm.entityId)}
            onSelectResource={onSelectResource}
          />
        ))}
      </div>
    );
  },
);
