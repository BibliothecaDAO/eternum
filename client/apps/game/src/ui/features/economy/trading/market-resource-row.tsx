import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { currencyFormat, formatNumber } from "@/ui/utils/utils";
import { useCoarseCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useResourceManager } from "@bibliothecadao/react";
import { findResourceById, ResourcesIds, ID } from "@bibliothecadao/types";
import { memo, useMemo } from "react";
import { SpreadIndicator } from "./spread-indicator";

interface MarketResourceRowProps {
  entityId: ID;
  resourceId: ResourcesIds;
  active: boolean;
  onClick: (value: number) => void;
  askPrice: number;
  bidPrice: number;
  ammPrice: number;
}

export const MarketResourceRow = memo(
  ({ entityId, resourceId, active, onClick, askPrice, bidPrice, ammPrice }: MarketResourceRowProps) => {
    const currentDefaultTick = useCoarseCurrentDefaultTick();
    const resourceManager = useResourceManager(entityId);

    const balance = useMemo(() => {
      return resourceManager.balanceWithProduction(currentDefaultTick, resourceId).balance;
    }, [resourceManager, currentDefaultTick, resourceId]);

    const resource = useMemo(() => findResourceById(resourceId), [resourceId]);

    const balanceNum = balance ? Number(balance) : 0;
    const balanceColor = balanceNum > 1000 ? "text-green/70" : balanceNum > 100 ? "text-yellow/70" : "text-red/50";

    return (
      <div
        onClick={() => onClick(resourceId)}
        className={`w-full rounded-lg px-1.5 py-1 cursor-pointer hover:bg-gold/10 transition-colors group ${
          active ? "panel-gold" : ""
        }`}
      >
        {/* Single row: name+balance | bid | ask | amm */}
        <div className="grid grid-cols-5 gap-1 items-center">
          <div className="flex items-center gap-1.5 col-span-2 min-w-0">
            <ResourceIcon size="xs" resource={resource?.trait || ""} withTooltip={false} />
            <span className="truncate text-xs">{resource?.trait || ""}</span>
            <span className={`text-[10px] ${balanceColor} shrink-0`}>[{currencyFormat(balanceNum, 0)}]</span>
          </div>
          <div className="text-green text-xs text-center">{formatNumber(bidPrice, 4)}</div>
          <div className="text-red text-xs text-center">{formatNumber(askPrice, 4)}</div>
          <div className="text-blueish text-xs text-center">{formatNumber(ammPrice, 4)}</div>
        </div>
        {/* Spread indicator */}
        <div className="mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <SpreadIndicator bidPrice={bidPrice} askPrice={askPrice} />
        </div>
      </div>
    );
  },
);

MarketResourceRow.displayName = "MarketResourceRow";
