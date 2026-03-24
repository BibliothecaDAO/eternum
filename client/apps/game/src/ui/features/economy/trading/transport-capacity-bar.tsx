import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { useResourceManager } from "@bibliothecadao/react";
import { ResourcesIds, ID } from "@bibliothecadao/types";
import { divideByPrecision, calculateDonkeysNeeded, getTotalResourceWeightKg } from "@bibliothecadao/eternum";
import { useMarketStore } from "@/hooks/store/use-market-store";
import { currencyFormat } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@bibliothecadao/eternum";
import { memo, useMemo } from "react";

interface TransportCapacityBarProps {
  entityId: ID;
  resourceId: ResourcesIds;
}

export const TransportCapacityBar = memo(({ entityId, resourceId }: TransportCapacityBarProps) => {
  const { currentDefaultTick } = getBlockTimestamp();
  const resourceManager = useResourceManager(entityId);
  const tradeAmount = useMarketStore((state) => state.tradeAmount);
  const tradeDirection = useMarketStore((state) => state.tradeDirection);

  const donkeyBalance = useMemo(() => {
    return divideByPrecision(resourceManager.balanceWithProduction(currentDefaultTick, ResourcesIds.Donkey).balance);
  }, [resourceManager, currentDefaultTick]);

  const projectedCost = useMemo(() => {
    if (tradeAmount <= 0) return 0;
    const transportedResourceId = tradeDirection === "buy" ? ResourcesIds.Lords : resourceId;
    const weightKg = getTotalResourceWeightKg([{ resourceId: transportedResourceId, amount: tradeAmount }]);
    return calculateDonkeysNeeded(weightKg);
  }, [tradeAmount, tradeDirection, resourceId]);

  const usagePercent = donkeyBalance > 0 ? Math.min((projectedCost / donkeyBalance) * 100, 100) : 0;
  const isOverCapacity = projectedCost > donkeyBalance;

  return (
    <div className="flex items-center gap-3 px-4 py-2 panel-wood-bottom text-sm">
      <ResourceIcon resource="Donkey" size="sm" withTooltip={false} />
      <div className="flex items-center gap-2 flex-1">
        <span className="text-gold/70">Transport:</span>
        <span className={`font-medium ${donkeyBalance === 0 ? "text-gold/40" : isOverCapacity ? "text-red" : "text-green"}`}>
          {donkeyBalance === 0 ? "No donkeys" : `${currencyFormat(donkeyBalance, 0)} available`}
        </span>
        {projectedCost > 0 && (
          <>
            <span className="text-gold/30">|</span>
            <span className={isOverCapacity ? "text-red" : "text-gold/70"}>{projectedCost} needed for trade</span>
          </>
        )}
      </div>
      {/* Capacity bar */}
      {donkeyBalance > 0 && (
        <div className="w-24 h-1.5 bg-gold/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${isOverCapacity ? "bg-red" : "bg-green"}`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>
      )}
    </div>
  );
});

TransportCapacityBar.displayName = "TransportCapacityBar";
