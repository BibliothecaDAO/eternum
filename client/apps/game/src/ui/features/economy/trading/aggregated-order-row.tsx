import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { formatNumber, currencyFormat } from "@/ui/utils/utils";
import { divideByPrecision } from "@bibliothecadao/eternum";
import { findResourceById, ResourcesIds } from "@bibliothecadao/types";
import { memo } from "react";
import type { AggregatedLevel } from "@/hooks/helpers/use-aggregated-depth";

interface AggregatedOrderRowProps {
  level: AggregatedLevel;
  isBid: boolean;
  resourceId: ResourcesIds;
}

export const AggregatedOrderRow = memo(({ level, isBid, resourceId }: AggregatedOrderRowProps) => {
  const resourceName = findResourceById(resourceId)?.trait || "";

  return (
    <div className="relative flex items-center gap-2 py-1 px-2 text-xs hover:bg-gold/5 rounded">
      {/* Depth bar background */}
      <div
        className={`absolute inset-y-0 ${isBid ? "right-0" : "left-0"} rounded opacity-15 ${
          isBid ? "bg-green" : "bg-red"
        }`}
        style={{ width: `${level.depthPercent}%` }}
      />

      {/* Content */}
      <div className="relative flex items-center w-full gap-2">
        {/* Own orders marker */}
        <div className="w-2 flex-shrink-0">
          {level.hasOwnOrders && (
            <div className="w-1.5 h-1.5 rounded-full bg-blueish" title="You have orders at this price" />
          )}
        </div>

        {/* Price */}
        <div className={`w-20 font-medium ${isBid ? "text-green" : "text-red"}`}>
          {formatNumber(level.price, 4)}
        </div>

        {/* Volume */}
        <div className="w-24 text-gold/80">
          {currencyFormat(divideByPrecision(level.totalVolume), 0)}
          <span className="ml-1 text-gold/40">
            <ResourceIcon resource={resourceName} size="xs" withTooltip={false} />
          </span>
        </div>

        {/* Order count */}
        <div className="w-12 text-gold/40 text-right">
          {level.orderCount} order{level.orderCount !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
});

AggregatedOrderRow.displayName = "AggregatedOrderRow";
