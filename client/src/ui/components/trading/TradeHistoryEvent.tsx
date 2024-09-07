import { getEntitiesUtils } from "@/hooks/helpers/useEntities";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { currencyIntlFormat } from "@/ui/utils/utils";
import { EternumGlobalConfig, Resource, ResourcesIds } from "@bibliothecadao/eternum";
import { Crown } from "lucide-react";
import { TradeEvent } from "./MarketTradingHistory";

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
  const { getAddressNameFromEntity } = getEntitiesUtils();
  const price = getLordsPricePerResource(trade.event.resourceGiven, trade.event.resourceTaken);
  const taker = getAddressNameFromEntity(trade.event.takerId);

  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_2fr_1fr] gap-1 flex-grow overflow-y-auto p-1">
      <div
        className={`text-xs my-auto`}
      >{`${trade.event.eventTime.toLocaleDateString()} ${trade.event.eventTime.toLocaleTimeString()}`}</div>
      <div className={`text-sm my-auto`}>{trade.type}</div>
      <div className={`text-sm my-auto flex flex-row items-center justify-start`}>
        {taker}
        {trade.event.isYours && <Crown className="h-4" />}
      </div>
      <div className="text-sm my-auto flex flex-row">
        <div>{"bought"}</div>
        <ResourceIcon resource={ResourcesIds[Number(trade.event.resourceTaken.resourceId)]} size={"sm"} />
        <div>{`${currencyIntlFormat(
          Number(trade.event.resourceTaken.amount) / EternumGlobalConfig.resources.resourcePrecision,
          2,
        )} for ${currencyIntlFormat(
          Number(trade.event.resourceGiven.amount) / EternumGlobalConfig.resources.resourcePrecision,
          2,
        )}`}</div>
        <ResourceIcon resource={ResourcesIds[Number(trade.event.resourceGiven.resourceId)]} size={"sm"} />
      </div>
      <div className="text-sm my-auto flex flex-row">
        {currencyIntlFormat(Number(price), 2)}
        <ResourceIcon resource={ResourcesIds[ResourcesIds.Lords]} size={"sm"} />
        per
        <ResourceIcon
          resource={
            ResourcesIds[
              Number(
                trade.event.resourceTaken.resourceId === ResourcesIds.Lords
                  ? trade.event.resourceGiven.resourceId
                  : trade.event.resourceTaken.resourceId,
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
  const lordsResource = resourceA.resourceId === ResourcesIds.Lords ? resourceA : resourceB;
  const otherResource = resourceA.resourceId === ResourcesIds.Lords ? resourceB : resourceA;

  return Number(lordsResource.amount) / Number(otherResource.amount);
};
