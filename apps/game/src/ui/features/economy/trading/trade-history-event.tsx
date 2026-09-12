import { HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { getRelativeTimeString } from "@/ui/utils/time-utils";
import { currencyIntlFormat, formatNumber } from "@/ui/utils/utils";
import { divideByPrecision, getAddressName } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress, Resource, ResourcesIds } from "@bibliothecadao/types";

export interface TradeEvent {
  type: "AMM Swap";
  event: {
    takerId: number;
    makerId: number;
    makerAddress: string;
    takerAddress: string;
    isYours: boolean;
    resourceGiven: Resource;
    resourceTaken: Resource;
    eventTime: Date;
  };
}

const HISTORY_GRID = "grid grid-cols-[5rem_1fr_2fr_1.2fr] items-center gap-2 px-3";

export const TradeHistoryRowHeader = () => (
  <div className={cn(HISTORY_GRID, "border-b border-gold/15 py-1.5", HUD_LABEL)}>
    <span>When</span>
    <span>Trader</span>
    <span>Swap</span>
    <span className="text-right">Lords each</span>
  </div>
);

export const TradeHistoryEvent = ({ trade }: { trade: TradeEvent }) => {
  const {
    setup: { components },
  } = useDojo();

  const resourceTaken = trade.event.resourceTaken;
  const resourceGiven = trade.event.resourceGiven;
  if (!resourceTaken || !resourceGiven) {
    return null;
  }

  const price = getLordsPricePerResource(resourceGiven, resourceTaken);
  const tradedResourceId =
    resourceTaken.resourceId === ResourcesIds.Lords ? resourceGiven.resourceId : resourceTaken.resourceId;
  const taker = getAddressName(ContractAddress(trade.event.takerAddress), components);
  const fullDateTime = `${trade.event.eventTime.toLocaleDateString()} ${trade.event.eventTime.toLocaleTimeString()}`;

  return (
    <div
      className={cn(
        HISTORY_GRID,
        "h-8 border-b border-gold/10 text-[11px] tabular-nums",
        trade.event.isYours ? "bg-blueish/10 text-gold" : "text-gold/85",
      )}
    >
      <span className="text-gold/60" title={fullDateTime}>
        {getRelativeTimeString(trade.event.eventTime)}
      </span>
      <span className="truncate">{taker}</span>
      <span className="flex items-center gap-1">
        <ResourceIcon resource={ResourcesIds[Number(resourceGiven.resourceId)]} size="xs" withTooltip={false} />
        {currencyIntlFormat(divideByPrecision(resourceGiven.amount), 2)}
        <span className="text-gold/50">→</span>
        <ResourceIcon resource={ResourcesIds[Number(resourceTaken.resourceId)]} size="xs" withTooltip={false} />
        {currencyIntlFormat(divideByPrecision(resourceTaken.amount), 2)}
      </span>
      <span className="flex items-center justify-end gap-1 font-semibold">
        {formatNumber(price, 4)}
        <ResourceIcon resource={ResourcesIds[Number(tradedResourceId)]} size="xs" withTooltip={false} />
      </span>
    </div>
  );
};

const getLordsPricePerResource = (resourceA: Resource, resourceB: Resource): number => {
  const lordsResource = resourceA.resourceId === ResourcesIds.Lords ? resourceA : resourceB;
  const otherResource = resourceA.resourceId === ResourcesIds.Lords ? resourceB : resourceA;
  if (Number(otherResource.amount) === 0) return 0;
  return Number(lordsResource.amount) / Number(otherResource.amount);
};
