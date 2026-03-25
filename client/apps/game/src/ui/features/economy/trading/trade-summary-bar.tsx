import { filterPendingOrders } from "@/hooks/helpers/use-pending-orders";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { currencyFormat } from "@/ui/utils/utils";
import { divideByPrecision } from "@bibliothecadao/eternum";
import { MarketInterface, ID } from "@bibliothecadao/types";
import { memo, useMemo } from "react";

interface TradeSummaryBarProps {
  bidOffers: MarketInterface[];
  askOffers: MarketInterface[];
  entityId: ID;
}

export const TradeSummaryBar = memo(({ bidOffers, askOffers, entityId }: TradeSummaryBarProps) => {
  const { count, totalLordsLocked } = useMemo(
    () => filterPendingOrders(bidOffers, askOffers, entityId),
    [bidOffers, askOffers, entityId],
  );

  if (count === 0) return null;

  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-gold/10 bg-brown/80 text-xs">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-gold/50">Open Orders:</span>
          <span className="font-medium text-gold bg-gold/10 px-1.5 py-0.5 rounded">{count}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-gold/50">Lords Locked:</span>
          <span className="font-medium text-gold">{currencyFormat(divideByPrecision(totalLordsLocked), 0)}</span>
          <ResourceIcon resource="Lords" size="xs" withTooltip={false} />
        </div>
      </div>
    </div>
  );
});

TradeSummaryBar.displayName = "TradeSummaryBar";
