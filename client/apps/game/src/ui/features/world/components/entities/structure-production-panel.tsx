import { ResourceManager, getBlockTimestamp } from "@bibliothecadao/eternum";
import { useBuildings } from "@bibliothecadao/react";
import { ClientComponents, ResourcesIds, getProducedResource } from "@bibliothecadao/types";
import { memo, useEffect, useMemo, useState } from "react";

import { ProductionStatusBadge } from "@/ui/shared";
import { currencyIntlFormat } from "@/ui/utils/utils";
import { ComponentValue } from "@dojoengine/recs";
import { formatTimeRemaining } from "../../../economy/resources/entity-resource-table/utils";
import { createProductionSortComparator } from "./production-sort";

interface StructureProductionPanelProps {
  structure: ComponentValue<ClientComponents["Structure"]["schema"]>;
  resources: ComponentValue<ClientComponents["Resource"]["schema"]>;
  compact?: boolean;
  smallTextClass: string;
  showProductionSummary?: boolean;
  showTooltip?: boolean;
  badgeVariant?: "default" | "detailed";
  /**
   * Map keyed by resourceId → human-readable reason describing why the last
   * automation cycle skipped producing this resource. When supplied, the badge
   * for each listed resource gets a red starvation ring and the reason string
   * is appended to the tooltip.
   */
  starvedResources?: Map<ResourcesIds, string>;
  /**
   * Map keyed by resourceId → consumption per second (human units). When supplied
   * alongside `badgeVariant="detailed"`, the badge's top-right corner shows the net
   * rate (`productionPerSecond − consumptionPerSecond`), colored green/red/muted.
   */
  consumptionPerSecondById?: Map<ResourcesIds, number>;
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

const formatOutputAmount = (value: number | null | undefined): string | undefined => {
  if (value === null || value === undefined || Number.isNaN(value)) return undefined;
  const abs = Math.abs(value);
  const decimals = abs >= 1000 ? 1 : 0;
  return currencyIntlFormat(abs, decimals);
};

const NET_RATE_EPSILON = 1e-6;

const formatNetRatePerSecond = (value: number): string => {
  const abs = Math.abs(value);
  const decimals = abs >= 1000 ? 0 : abs >= 10 ? 1 : 2;
  const magnitude = currencyIntlFormat(abs, decimals);
  if (value > NET_RATE_EPSILON) return `+${magnitude}/s`;
  if (value < -NET_RATE_EPSILON) return `-${magnitude}/s`;
  return `0/s`;
};

export const StructureProductionPanel = memo(
  ({
    structure,
    resources,
    compact = false,
    smallTextClass,
    showProductionSummary = true,
    showTooltip = true,
    badgeVariant = "default",
    starvedResources,
    consumptionPerSecondById,
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
    const productionBadgeSize = badgeVariant === "detailed" ? "md" : compact ? "xs" : "sm";

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
      return <p className={`${smallTextClass} text-gold/60 italic`}>No production buildings.</p>;
    }

    return (
      <>
        {showProductionSummary && (
          <div className={`${smallTextClass} text-gold/60 mb-2`}>
            {`${activeProductionBuildings}/${totalProductionBuildings} producing`}
          </div>
        )}
        <div
          className={
            badgeVariant === "detailed" ? "flex flex-wrap items-center gap-3" : "flex flex-wrap items-center gap-2"
          }
        >
          {resourceProductionSummary.toSorted(createProductionSortComparator(starvedResources)).map((summary) => {
            const resourceLabel = ResourcesIds[summary.resourceId];
            const elapsedSeconds = (currentTime - summary.calculatedAt) / 1000;
            const effectiveOutputRemaining =
              summary.isProducing &&
              summary.outputRemaining !== null &&
              summary.productionPerSecond !== null &&
              Number.isFinite(summary.productionPerSecond)
                ? Math.max(summary.outputRemaining - elapsedSeconds * summary.productionPerSecond, 0)
                : summary.outputRemaining;
            const effectiveRemainingSeconds =
              summary.timeRemainingSeconds !== null ? Math.max(summary.timeRemainingSeconds - elapsedSeconds, 0) : null;
            const formattedRemaining =
              summary.isProducing && effectiveRemainingSeconds !== null
                ? formatTimeRemaining(Math.ceil(effectiveRemainingSeconds))
                : null;
            const starvationReason = starvedResources?.get(summary.resourceId);
            const isStarved = typeof starvationReason === "string" && starvationReason.length > 0;
            const tooltipParts = summary.isProducing
              ? [
                  resourceLabel,
                  `${summary.activeBuildings}/${summary.totalBuildings} producing`,
                  formattedRemaining ? `${formattedRemaining} left` : null,
                ]
              : [resourceLabel, `Idle (${summary.totalBuildings} building${summary.totalBuildings !== 1 ? "s" : ""})`];
            if (isStarved) {
              tooltipParts.push(`⚠ ${starvationReason}`);
            }
            const outputLabel = summary.isProducing ? formatOutputAmount(effectiveOutputRemaining) : undefined;
            let netRateLabel: string | undefined;
            if (badgeVariant === "detailed") {
              const production = Number.isFinite(summary.productionPerSecond) ? (summary.productionPerSecond ?? 0) : 0;
              const consumption = consumptionPerSecondById?.get(summary.resourceId) ?? 0;
              const hasSignal = production !== 0 || consumption !== 0;
              if (hasSignal) {
                netRateLabel = formatNetRatePerSecond(production - consumption);
              }
            }
            const badgeProps =
              badgeVariant === "detailed"
                ? {
                    cornerTopLeft: summary.totalBuildings > 0 ? `${summary.totalBuildings}` : undefined,
                    cornerTopRight: netRateLabel ?? outputLabel,
                    cornerBottomRight: formattedRemaining ?? undefined,
                  }
                : {
                    totalCount: summary.totalBuildings,
                  };

            let cornerTopRightClassName: string | undefined;
            if (badgeVariant === "detailed" && netRateLabel) {
              if (netRateLabel.startsWith("+")) {
                cornerTopRightClassName = "text-emerald-400";
              } else if (netRateLabel.startsWith("-")) {
                cornerTopRightClassName = "text-red-400";
              } else {
                cornerTopRightClassName = "text-gold/50";
              }
            }

            return (
              <ProductionStatusBadge
                key={summary.resourceId}
                resourceLabel={resourceLabel}
                tooltipText={tooltipParts.filter(Boolean).join(" • ")}
                isProducing={summary.isProducing}
                timeRemainingSeconds={effectiveRemainingSeconds}
                size={productionBadgeSize}
                showTooltip={showTooltip}
                className={isStarved ? "rounded-full ring-1 ring-red-500/60" : undefined}
                cornerTopRightClassName={cornerTopRightClassName}
                {...badgeProps}
              />
            );
          })}
        </div>
      </>
    );
  },
);

StructureProductionPanel.displayName = "StructureProductionPanel";
