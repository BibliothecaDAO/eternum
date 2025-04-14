import { useSyncMarketHistory } from "@/hooks/helpers/use-sync";
import { EventType, TradeHistoryEvent, TradeHistoryRowHeader } from "@/ui/components/trading/trade-history-event";
import { Checkbox } from "@/ui/elements/checkbox";
import { LoadingAnimation } from "@/ui/elements/loading-animation";
import { SelectResource } from "@/ui/elements/select-resource";
import { ContractAddress, ID, Resource, ResourcesIds, world } from "@bibliothecadao/types";
import { getTradeResources, } from "@bibliothecadao/eternum"
import { useDojo } from "@bibliothecadao/react";
import { defineComponentSystem, getComponentValue, isComponentUpdate } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { memo, useEffect, useMemo, useState } from "react";

const MAX_TRADES = 100;

export type TradeEvent = {
  type: EventType;
  event: {
    takerId: ID;
    makerId: ID;
    isYours: boolean;
    resourceGiven: Resource;
    resourceTaken: Resource;
    eventTime: Date;
  };
};

export const MarketTradingHistory = () => {
  const { isSyncing } = useSyncMarketHistory();

  return isSyncing ? <LoadingAnimation /> : <MarketTradingHistoryContent />;
};

export const MarketTradingHistoryContent = memo(() => {
  const {
    account: {
      account: { address },
    },
    setup: { components },
  } = useDojo();

  const [tradeEvents, setTradeEvents] = useState<TradeEvent[]>([]);
  const [showOnlyYourSwaps, setShowOnlyYourSwaps] = useState(false);

  const events = components.events;

  useEffect(() => {
    defineComponentSystem(world, events.AcceptOrder, (update) => {
      if (isComponentUpdate(update, events.AcceptOrder)) {
        const event = getComponentValue(events.AcceptOrder, update.entity);
        if (!event) return;
        const trade = getComponentValue(components.Trade, getEntityIdFromKeys([BigInt(event.trade_id)]));
        if (!trade) return;
        const takerOwner = getComponentValue(
          components.Structure,
          getEntityIdFromKeys([BigInt(event.taker_id)]),
        )?.owner;
        if (!takerOwner) return;

        const makerOwner = getComponentValue(
          components.Structure,
          getEntityIdFromKeys([BigInt(event.maker_id)]),
        )?.owner;
        if (!makerOwner) return;

        const { makerGets, takerGets } = getTradeResources(trade.trade_id, components);

        setTradeEvents((prevTradeEvents) => {
          return [
            ...prevTradeEvents,
            {
              type: EventType.ORDERBOOK,
              event: {
                takerId: event.taker_id,
                makerId: event.maker_id,
                isYours: takerOwner === ContractAddress(address) || makerOwner === ContractAddress(address),
                resourceGiven: makerGets[0],
                resourceTaken: takerGets[0],
                eventTime: new Date(event.timestamp * 1000),
              },
            },
          ];
        });
      }
    });

    defineComponentSystem(world, events.SwapEvent, (update) => {
      if (isComponentUpdate(update, events.SwapEvent)) {
        const event = getComponentValue(events.SwapEvent, update.entity);
        if (!event) return;
        const takerOwner = getComponentValue(
          components.Structure,
          getEntityIdFromKeys([BigInt(event.entity_id)]),
        )?.owner;
        if (!takerOwner) return;

        setTradeEvents((prevTradeEvents) => {
          return [
            ...prevTradeEvents,
            {
              type: EventType.SWAP,
              event: {
                takerId: event.entity_id,
                makerId: event.bank_entity_id,
                isYours: takerOwner === ContractAddress(address),
                resourceGiven: event.buy
                  ? { resourceId: ResourcesIds.Lords, amount: Number(event.lords_amount) }
                  : { resourceId: event.resource_type, amount: Number(event.resource_amount) },
                resourceTaken: event.buy
                  ? { resourceId: event.resource_type, amount: Number(event.resource_amount) }
                  : { resourceId: ResourcesIds.Lords, amount: Number(event.lords_amount) },
                eventTime: new Date(event.timestamp * 1000),
              },
            },
          ];
        });
      }
    });
  }, []);

  const filteredTradeEvents = useMemo(
    () => (showOnlyYourSwaps ? tradeEvents.filter((trade) => trade.event.isYours) : tradeEvents),
    [showOnlyYourSwaps, tradeEvents],
  );

  const [selectedResourceId, setSelectedResourceId] = useState<number | null>(null);

  return (
    <div className="flex flex-col px-8 mt-8">
      <div className="flex flex-row items-center justify-between mb-6">
        <div onClick={() => setShowOnlyYourSwaps((prev) => !prev)} className="flex items-center space-x-2">
          <Checkbox enabled={showOnlyYourSwaps} />
          <div className="text-sm text-gray-300 hover:text-white transition-colors duration-200">
            Show only your swaps
          </div>
        </div>
        <div className="w-1/3">
          <SelectResource onSelect={(resourceId) => setSelectedResourceId(resourceId)} className="w-full" />
        </div>
      </div>
      <TradeHistoryRowHeader />
      {filteredTradeEvents
        .sort((a, b) => b.event.eventTime.getTime() - a.event.eventTime.getTime())
        .filter((trade) =>
          trade.event.resourceGiven && trade.event.resourceTaken && selectedResourceId
            ? trade.event.resourceGiven.resourceId === selectedResourceId ||
            trade.event.resourceTaken.resourceId === selectedResourceId
            : true,
        )
        .slice(0, MAX_TRADES)
        .map((trade, index) => {
          return <TradeHistoryEvent key={index} trade={trade} />;
        })}
    </div>
  );
});
