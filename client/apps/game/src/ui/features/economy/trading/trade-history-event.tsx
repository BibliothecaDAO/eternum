import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { getRelativeTimeString } from "@/ui/utils/time-utils";
import { currencyIntlFormat, formatNumber } from "@/ui/utils/utils";
import { divideByPrecision, getAddressName } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress, Resource, ResourcesIds } from "@bibliothecadao/types";
import { TradeEvent } from "./market-trading-history";

export enum EventType {
  SWAP = "AMM Swap",
  ORDERBOOK = "Orderbook",
}

export const TradeHistoryRowHeader = () => {
  const headers = ["Time", "Type", "Taker", "Trade", "Price"];

  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_2fr_1fr] gap-1 flex-grow overflow-y-auto mb-4">
      {headers.map((header, index) => (
        <div key={index} className="uppercase text-xs font-bold">
          {header}
        </div>
      ))}
    </div>
  );
};

export const TradeHistoryEvent = ({ trade }: { trade: TradeEvent }) => {
  const {
    setup: { components },
  } = useDojo();

  const resourceTaken = trade.event.resourceTaken;
  const resourceGiven = trade.event.resourceGiven;
  if (!resourceTaken || !resourceGiven) {
    return null;
  }

  const price = getLordsPricePerResource(trade.event.resourceGiven, trade.event.resourceTaken);
  const taker = getAddressName(ContractAddress(trade.event.takerAddress), components);
  const relativeTime = getRelativeTimeString(trade.event.eventTime);
  const fullDateTime = `${trade.event.eventTime.toLocaleDateString()} ${trade.event.eventTime.toLocaleTimeString()}`;

  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_2fr_1fr] gap-1 flex-grow overflow-y-auto p-1">
      <div className="text-xs my-auto cursor-help" title={fullDateTime}>
        {relativeTime}
      </div>
      <div className={`text-sm my-auto`}>{trade.type}</div>
      <div className={`text-sm my-auto flex flex-row items-center justify-start`}>{taker}</div>
      <div className="text-sm my-auto flex flex-row">
        <div>{"bought"}</div>
        <ResourceIcon resource={ResourcesIds[Number(resourceTaken.resourceId)]} size={"sm"} />
        <div>{`${currencyIntlFormat(divideByPrecision(resourceTaken.amount), 2)} for ${currencyIntlFormat(
          divideByPrecision(resourceGiven.amount),
          2,
        )}`}</div>
        <ResourceIcon resource={ResourcesIds[Number(resourceGiven.resourceId)]} size={"sm"} />
      </div>
      <div className="text-sm my-auto flex flex-row">
        {formatNumber(price, 8)}
        <ResourceIcon resource={ResourcesIds[ResourcesIds.Lords]} size={"sm"} />
        per
        <ResourceIcon
          resource={
            ResourcesIds[
              Number(
                resourceTaken.resourceId === ResourcesIds.Lords ? resourceGiven.resourceId : resourceTaken.resourceId,
              )
            ]
          }
          size={"sm"}
        />
      </div>
    </div>
  );
};

const getLordsPricePerResource = (resourceA: Resource, resourceB: Resource): number => {
  try {
    const lordsResource = resourceA.resourceId === ResourcesIds.Lords ? resourceA : resourceB;
    const otherResource = resourceA.resourceId === ResourcesIds.Lords ? resourceB : resourceA;

    return Number(lordsResource.amount) / Number(otherResource.amount);
  } catch (e) {
    console.error(e);
    return 0;
  }
};
