import { ResourceIcon } from "@/ui/elements/resource-icon";
import { currencyIntlFormat } from "@/ui/utils/utils";
import { divideByPrecision, getAddressNameFromEntity } from "@bibliothecadao/eternum";
import { Resource, ResourcesIds } from "@bibliothecadao/types";
import { useDojo } from "@bibliothecadao/react";
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
  const taker = getAddressNameFromEntity(trade.event.takerId, components);

  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_2fr_1fr] gap-1 flex-grow overflow-y-auto p-1">
      <div
        className={`text-xs my-auto`}
      >{`${trade.event.eventTime.toLocaleDateString()} ${trade.event.eventTime.toLocaleTimeString()}`}</div>
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
        {currencyIntlFormat(Number(price), 2)}
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
