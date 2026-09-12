import { filterPendingOrders } from "@/hooks/helpers/use-pending-orders";
import { HUD_CUE, HUD_VALUE } from "@/ui/design-system/atoms/hud-typography";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { currencyFormat } from "@/ui/utils/utils";
import { ID, MarketInterface } from "@bibliothecadao/types";
import { memo, useMemo } from "react";

interface TradeSummaryBarProps {
  bidOffers: MarketInterface[];
  askOffers: MarketInterface[];
  entityId: ID;
}

/** This structure's open orders and the Lords they hold, shown beside the market tabs. */
export const TradeSummaryBar = memo(({ bidOffers, askOffers, entityId }: TradeSummaryBarProps) => {
  const { count, totalLordsLocked } = useMemo(
    () => filterPendingOrders(bidOffers, askOffers, entityId),
    [bidOffers, askOffers, entityId],
  );

  if (count === 0) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-1">
        <span className={HUD_CUE}>Open orders</span>
        <span className={HUD_VALUE}>{count}</span>
      </span>
      <span className="flex items-center gap-1">
        <span className={HUD_CUE}>Locked</span>
        <span className={HUD_VALUE}>{currencyFormat(totalLordsLocked, 0)}</span>
        <ResourceIcon resource="Lords" size="xs" withTooltip={false} />
      </span>
    </div>
  );
});

TradeSummaryBar.displayName = "TradeSummaryBar";
