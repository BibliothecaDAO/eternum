import { HudTableHead, HudTableRow } from "@/ui/design-system/kit/hud-elements";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { divideByPrecision } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import {
  ContractAddress,
  Resource,
  ResourcesIds,
  formatAmount,
  formatMoment,
  formatAgo,
  formatFigure,
} from "@bibliothecadao/types";
import { usePlayerDisplayName } from "@/hooks/use-player-profile";

export interface TradeEvent {
  id: string;
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

const HISTORY_COLS = "5rem 1fr 2fr 1.2fr";

export const TradeHistoryRowHeader = () => (
  <HudTableHead cols={HISTORY_COLS}>
    <span>When</span>
    <span>Trader</span>
    <span>Swap</span>
    <span className="text-right">Lords each</span>
  </HudTableHead>
);

export const TradeHistoryEvent = ({ trade }: { trade: TradeEvent }) => {
  const {
    setup: { store },
  } = useGame();

  const resourceTaken = trade.event.resourceTaken;
  const resourceGiven = trade.event.resourceGiven;
  if (!resourceTaken || !resourceGiven) {
    return null;
  }

  const price = getLordsPricePerResource(resourceGiven, resourceTaken);
  const tradedResourceId =
    resourceTaken.resourceId === ResourcesIds.Lords ? resourceGiven.resourceId : resourceTaken.resourceId;
  const taker = usePlayerDisplayName(trade.event.takerAddress);
  const fullDateTime = formatMoment(trade.event.eventTime.getTime() / 1000);

  return (
    <HudTableRow
      cols={HISTORY_COLS}
      label={`${taker} swapped, ${formatAgo(trade.event.eventTime.getTime() / 1000)}`}
      selected={trade.event.isYours}
    >
      <span className="text-hud-muted" title={fullDateTime}>
        {formatAgo(trade.event.eventTime.getTime() / 1000)}
      </span>
      <span className="truncate">{taker}</span>
      <span className="flex items-center gap-1 tabular-nums">
        <ResourceIcon resource={Number(resourceGiven.resourceId)} size="xs" withTooltip={false} />
        {formatAmount(divideByPrecision(resourceGiven.amount, false))}
        <span className="text-hud-muted">→</span>
        <ResourceIcon resource={Number(resourceTaken.resourceId)} size="xs" withTooltip={false} />
        {formatAmount(divideByPrecision(resourceTaken.amount, false))}
      </span>
      <span className="flex items-center justify-end gap-1 text-hud-strong tabular-nums">
        {formatFigure(price)}
        <ResourceIcon resource={Number(tradedResourceId)} size="xs" withTooltip={false} />
      </span>
    </HudTableRow>
  );
};

const getLordsPricePerResource = (resourceA: Resource, resourceB: Resource): number => {
  const lordsResource = resourceA.resourceId === ResourcesIds.Lords ? resourceA : resourceB;
  const otherResource = resourceA.resourceId === ResourcesIds.Lords ? resourceB : resourceA;
  if (Number(otherResource.amount) === 0) return 0;
  return Number(lordsResource.amount) / Number(otherResource.amount);
};
