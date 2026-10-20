import { knownAmount } from "@/ui/utils/utils";
import { ResourcesIds, formatAmount } from "@bibliothecadao/types";
import { filterPendingOrders } from "@/hooks/helpers/use-pending-orders";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
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
    <div className="flex items-center gap-3 text-hud-label">
      <span className="flex items-center gap-1">
        <span className="text-hud-muted">Open orders</span>
        <span className="text-hud-strong">{count}</span>
      </span>
      <span className="flex items-center gap-1">
        <span className="text-hud-muted">Locked</span>
        <span className="text-hud-strong">{formatAmount(knownAmount(totalLordsLocked))}</span>
        <ResourceIcon resource={ResourcesIds.Lords} size="xs" withTooltip={false} />
      </span>
    </div>
  );
});

TradeSummaryBar.displayName = "TradeSummaryBar";
