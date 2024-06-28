import { useDojo } from "@/hooks/context/DojoContext";
import { useEntities } from "@/hooks/helpers/useEntities";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { EternumGlobalConfig, ResourcesIds } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { TradeEvent } from "./MarketTradingHistory";

export enum EventType {
  ORDER_CREATED = "Created order",
  ORDER_ACCEPTED = "Order accepted",
  ORDER_CANCELLED = "Order cancel",
  ORDER_EXPIRED = "Order expired",
  BOUGHT = "Took an order",
}

export enum TradeStatus {
  OPEN = 0,
  ACCEPTED = 1,
  CANCELLED = 2,
}

export const TradeHistoryRowHeader = () => {
  return (
    <div className="grid grid-cols-5 gap-1 flex-grow overflow-y-auto mb-4">
      <div className="uppercase text-xs font-bold">Time</div>
      <div className="uppercase text-xs font-bold">Status</div>
      <div className="uppercase text-xs font-bold">Taker</div>
      <div className="uppercase text-xs font-bold">Trade</div>
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

  const { getAddressNameFromEntity } = useEntities();
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

  return (
    <div className="grid grid-cols-5 gap-1 flex-grow overflow-y-auto h-14 mb-4 p-1 clip-angled-sm">
      <div className="text-xs my-auto">{`${trade.event.eventTime.toLocaleDateString()} ${trade.event.eventTime.toLocaleTimeString()}`}</div>
      <div className="text-sm my-auto">{eventType}</div>
      <div className="text-sm my-auto">{taker}</div>
      <div className="text-sm my-auto flex flex-row">
        {resourceGiven && <ResourceIcon resource={ResourcesIds[Number(resourceGiven[0]!.resource_type)]} size={"sm"} />}{" "}
        <div>{`${Number(resourceGiven[0]!.resource_amount) / EternumGlobalConfig.resources.resourcePrecision} for ${
          Number(resourceTaken[0]!.resource_amount) / EternumGlobalConfig.resources.resourcePrecision
        }`}</div>
        {resourceTaken && <ResourceIcon resource={ResourcesIds[Number(resourceTaken[0]!.resource_type)]} size={"sm"} />}{" "}
      </div>
      <div className="text-sm my-auto">
        {expirationDate && `${expirationDate.toLocaleDateString()} ${expirationDate.toLocaleTimeString()}`}
      </div>
    </div>
  );
};
