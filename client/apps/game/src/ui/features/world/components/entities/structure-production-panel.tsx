import { ClientComponents, ResourcesIds } from "@bibliothecadao/types";
import { memo, useEffect, useMemo, useState } from "react";

import { ProductionStatusBadge } from "@/ui/shared";
import { currencyIntlFormat } from "@/ui/utils/utils";
import { ComponentValue } from "@dojoengine/recs";
import { formatTimeRemaining } from "../../../economy/resources/entity-resource-table/utils";
import { createProductionSortComparator } from "./production-sort";
import {
  StructureProductionSummary,
  useStructureProductionSummary,
} from "@/ui/features/world/components/entities/structure-production-summary";

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

interface StructureProductionPanelViewProps extends Omit<StructureProductionPanelProps, "structure" | "resources"> {
  productionSummary: StructureProductionSummary;
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

export const StructureProductionPanelView = memo(
  ({
    compact = false,
    smallTextClass,
    showProductionSummary = true,
    showTooltip = true,
    badgeVariant = "default",
    starvedResources,
    consumptionPerSecondById,
    productionSummary,
  }: StructureProductionPanelViewProps) => {
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
    const { activeProductionBuildings, items: resourceProductionSummary, totalProductionBuildings } = productionSummary;

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

StructureProductionPanelView.displayName = "StructureProductionPanelView";

export const StructureProductionPanel = memo((props: StructureProductionPanelProps) => {
  const { resources, structure, ...viewProps } = props;
  const productionSummary = useStructureProductionSummary(structure, resources);

  return <StructureProductionPanelView {...viewProps} productionSummary={productionSummary} />;
});

StructureProductionPanel.displayName = "StructureProductionPanel";
