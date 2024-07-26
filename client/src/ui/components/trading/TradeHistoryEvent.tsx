import { useDojo } from "@/hooks/context/DojoContext";
import { getEntitiesUtils } from "@/hooks/helpers/useEntities";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { currencyIntlFormat } from "@/ui/utils/utils";
import { EternumGlobalConfig, ResourcesIds } from "@bibliothecadao/eternum";
import { ComponentValue, getComponentValue, Type } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { TradeEvent } from "./MarketTradingHistory";

export enum EventType {
  ORDER_CREATED = "Created order",
  ORDER_ACCEPTED = "Order accepted",
  ORDER_CANCELLED = "Order cancel",
  ORDER_EXPIRED = "Order expired",
  BOUGHT = "Took an order",
}

const colors = {
  [EventType.ORDER_CREATED]: "text-gold",
  [EventType.ORDER_ACCEPTED]: "text-green",
  [EventType.ORDER_CANCELLED]: "text-danger",
  [EventType.ORDER_EXPIRED]: "text-danger",
  [EventType.BOUGHT]: "text-green",
};

export enum TradeStatus {
  OPEN = 0,
  ACCEPTED = 1,
  CANCELLED = 2,
}

export const TradeHistoryRowHeader = () => {
  return (
    <div className="grid grid-cols-6 gap-1 flex-grow overflow-y-auto mb-4">
      <div className="uppercase text-xs font-bold">Time</div>
      <div className="uppercase text-xs font-bold">Status</div>
      <div className="uppercase text-xs font-bold">Taker</div>
      <div className="uppercase text-xs font-bold">Trade</div>
      <div className="uppercase text-xs font-bold">Price</div>
      <div className="uppercase text-xs font-bold">Expiration</div>
    </div>
  );
};

export const TradeHistoryEvent = ({ trade }: { trade: TradeEvent }) => {
  const {
    setup: {
      components: { Trade },
    },
  } = useDojo();
  const { nextBlockTimestamp } = useBlockchainStore();

  const { getAddressNameFromEntity } = getEntitiesUtils();
  const tradeComponent = getComponentValue(Trade, getEntityIdFromKeys([trade.event.tradeId]));
  const eventType =
    trade.type === EventType.ORDER_CREATED && nextBlockTimestamp! > tradeComponent!.expires_at
      ? EventType.ORDER_EXPIRED
      : trade.type;

  const taker =
    eventType !== EventType.BOUGHT
      ? getAddressNameFromEntity(trade.event.takerId) || ""
      : `${getAddressNameFromEntity(trade.event.makerId)} (You)`;

  const { getResourceBalance } = useResourceBalance();
  const resourceGiven =
    trade.type === EventType.BOUGHT
      ? getResourceBalance(tradeComponent!.taker_gives_resources_id)
      : getResourceBalance(tradeComponent!.maker_gives_resources_id);
  const resourceTaken =
    trade.type === EventType.BOUGHT
      ? getResourceBalance(tradeComponent!.maker_gives_resources_id)
      : getResourceBalance(tradeComponent!.taker_gives_resources_id);

  const expirationDate =
    trade.type === EventType.ORDER_CREATED ? new Date(tradeComponent!.expires_at * 1000) : undefined;

  const price = getPrice(resourceGiven[0], resourceTaken[0]);

  return (
    <div className="grid grid-cols-6 gap-1 flex-grow overflow-y-auto h-14 mb-4 p-1 clip-angled-sm">
      <div
        className={`text-xs my-auto`}
      >{`${trade.event.eventTime.toLocaleDateString()} ${trade.event.eventTime.toLocaleTimeString()}`}</div>
      <div className={`text-sm my-auto ${colors[eventType]}`}>{eventType}</div>
      <div className={`text-sm my-auto`}>{taker}</div>
      <div className="text-sm my-auto flex flex-row font-bold">
        {resourceGiven && <ResourceIcon resource={ResourcesIds[Number(resourceGiven[0]!.resource_type)]} size={"sm"} />}{" "}
        <div>{`${currencyIntlFormat(
          Number(resourceGiven[0]!.resource_amount) / EternumGlobalConfig.resources.resourcePrecision,
          2,
        )} for ${currencyIntlFormat(
          Number(resourceTaken[0]!.resource_amount) / EternumGlobalConfig.resources.resourcePrecision,
          2,
        )}`}</div>
        {resourceTaken && <ResourceIcon resource={ResourcesIds[Number(resourceTaken[0]!.resource_type)]} size={"sm"} />}{" "}
      </div>
      <div className="text-sm my-auto flex flex-row font-bold">
        {currencyIntlFormat(price, 2)}
        <ResourceIcon resource={ResourcesIds[Number(resourceTaken[0]!.resource_type)]} size={"sm"} />
        per/
        <ResourceIcon resource={ResourcesIds[Number(resourceGiven[0]!.resource_type)]} size={"sm"} />
      </div>
      <div className="text-sm my-auto">
        {expirationDate && `${expirationDate.toLocaleDateString()} ${expirationDate.toLocaleTimeString()}`}
      </div>
    </div>
  );
};

const getPrice = (
  resourceA:
    | ComponentValue<
        {
          entity_id: Type.BigInt;
          index: Type.Number;
          resource_type: Type.Number;
          resource_amount: Type.BigInt;
        },
        unknown
      >
    | undefined,
  resourceB:
    | ComponentValue<
        {
          entity_id: Type.BigInt;
          index: Type.Number;
          resource_type: Type.Number;
          resource_amount: Type.BigInt;
        },
        unknown
      >
    | undefined,
): Number => {
  if (resourceA!.resource_type === ResourcesIds.Lords) {
    return Number(resourceA!.resource_amount) / Number(resourceB!.resource_amount);
  } else {
    return Number(resourceB!.resource_amount) / Number(resourceA!.resource_amount);
  }
};
