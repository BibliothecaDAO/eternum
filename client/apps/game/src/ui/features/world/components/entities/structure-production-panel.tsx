import { ResourceManager, getBlockTimestamp } from "@bibliothecadao/eternum";
import { useBuildings } from "@bibliothecadao/react";
import { ClientComponents, ResourcesIds, getProducedResource } from "@bibliothecadao/types";
import { memo, useEffect, useMemo, useState } from "react";

import { BottomHudEmptyState } from "@/ui/features/world/components/hud-bottom";
import { ProductionStatusBadge } from "@/ui/shared";
import { ComponentValue } from "@dojoengine/recs";
import { formatTimeRemaining } from "../../../economy/resources/entity-resource-table/utils";

interface StructureProductionPanelProps {
  structure: ComponentValue<ClientComponents["Structure"]["schema"]>;
  resources: ComponentValue<ClientComponents["Resource"]["schema"]>;
  compact?: boolean;
  smallTextClass: string;
  showProductionSummary?: boolean;
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

export const StructureProductionPanel = memo(
  ({
    structure,
    resources,
    compact = false,
    smallTextClass,
    showProductionSummary = true,
  }: StructureProductionPanelProps) => {
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
    const productionBadgeSize = compact ? "xs" : "sm";

    const { currentDefaultTick } = getBlockTimestamp();

    const buildingsData = useBuildings(Number(structure.base.coord_x ?? 0), Number(structure.base.coord_y ?? 0));

    const productionBuildings = useMemo(
      () => (buildingsData ?? []).filter((building) => building && getProducedResource(building.category)),
      [buildingsData],
    );

    const resourceProductionSummary = useMemo<ResourceProductionSummaryItem[]>(() => {
      if (!productionBuildings.length) return [];

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

        const productionInfo = ResourceManager.balanceAndProduction(resources, resourceId);
        const productionData = ResourceManager.calculateResourceProductionData(
          resourceId,
          productionInfo,
          currentDefaultTick || 0,
        );
        isProducing = productionData.isProducing;

        if (isProducing) {
          const buildingCount = Number(productionInfo.production?.building_count ?? 0);
          activeBuildings = buildingCount > 0 ? buildingCount : stats.totalBuildings;
        }

        timeRemainingSeconds = Number.isFinite(productionData.timeRemainingSeconds)
          ? productionData.timeRemainingSeconds
          : null;
        productionPerSecond = Number.isFinite(productionData.productionPerSecond)
          ? productionData.productionPerSecond
          : null;
        outputRemaining = Number.isFinite(productionData.outputRemaining) ? productionData.outputRemaining : null;

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
    }, [productionBuildings, resources, currentDefaultTick]);

    const totalProductionBuildings = resourceProductionSummary.reduce(
      (accumulator, summary) => accumulator + summary.totalBuildings,
      0,
    );
    const activeProductionBuildings = resourceProductionSummary.reduce(
      (accumulator, summary) => accumulator + summary.activeBuildings,
      0,
    );

    if (!resourceProductionSummary.length) {
      return (
        <BottomHudEmptyState tone="subtle" className="min-h-0" textClassName={`${smallTextClass} text-gold/60 italic`}>
          No production buildings.
        </BottomHudEmptyState>
      );
    }

    return (
      <>
        {showProductionSummary && (
          <div className={`${smallTextClass} text-gold/60 mb-2`}>
            {`${activeProductionBuildings}/${totalProductionBuildings} producing`}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {[...resourceProductionSummary]
            .sort((a, b) => {
              if (a.resourceId === ResourcesIds.Wheat && b.resourceId !== ResourcesIds.Wheat) return -1;
              if (b.resourceId === ResourcesIds.Wheat && a.resourceId !== ResourcesIds.Wheat) return 1;
              return a.resourceId - b.resourceId;
            })
            .map((summary) => {
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
                  size={productionBadgeSize}
                />
              );
            })}
        </div>
      </>
    );
  },
);

StructureProductionPanel.displayName = "StructureProductionPanel";
