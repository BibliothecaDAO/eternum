import { client } from "@/dojo/events/graphqlClient";
import { useEffect, useState } from "react";
import { EventType, TradeHistoryEvent, TradeHistoryRowHeader } from "./TradeHistoryEvent";
import { ID } from "@bibliothecadao/eternum";
import { ACCEPT_ORDER_SELECTOR, CANCEL_ORDER_SELECTOR, CREATE_ORDER_SELECTOR } from "@/constants/events";

const TAKER_INDEX = 1;
const MAKER_INDEX = 2;

interface MarketTradingHistoryProps {
  structureEntityId: ID;
}

export type TradeEvent = {
  type: EventType;
  event: {
    takerId: ID;
    makerId: ID;
    tradeId: ID;
    eventTime: Date;
  };
};

export const MarketTradingHistory = ({ structureEntityId }: MarketTradingHistoryProps) => {
  const [tradeEvents, setTradeEvents] = useState<TradeEvent[]>([]);

  const queryTrades = async () => {
    const trades: any = await client.request(`
    query {
      createdOrders: events(keys: ["${CREATE_ORDER_SELECTOR}", "*"]) {
        edges {
          node {
            id
            keys
            data
          }
        }
      }
      acceptOrders: events(keys: ["${ACCEPT_ORDER_SELECTOR}", "*"]) {
        edges {
          node {
            id
            keys
            data
          }
        }
      }
      cancelOrders: events(keys: ["${CANCEL_ORDER_SELECTOR}", "*"]) {
        edges {
          node {
            id
            keys
            data
          }
        }
      }
    }
  `);
    const createdOrders = filterAndReturnTradeEvents(
      trades.createdOrders.edges,
      structureEntityId,
      EventType.ORDER_CREATED,
      MAKER_INDEX,
    );
    const myAcceptedOrders = filterAndReturnTradeEvents(
      trades.acceptOrders.edges,
      structureEntityId,
      EventType.ORDER_ACCEPTED,
      MAKER_INDEX,
    );
    const ordersIAccepted = filterAndReturnTradeEvents(
      trades.acceptOrders.edges,
      structureEntityId,
      EventType.BOUGHT,
      TAKER_INDEX,
    );
    const canceledOrders = filterAndReturnTradeEvents(
      trades.cancelOrders.edges,
      structureEntityId,
      EventType.ORDER_CANCELLED,
      MAKER_INDEX,
    );

    setTradeEvents(
      [...createdOrders, ...myAcceptedOrders, ...ordersIAccepted, ...canceledOrders].sort(
        (a, b) => b.event.eventTime.getTime() - a.event.eventTime.getTime(),
      ),
    );
  };

  useEffect(() => {
    queryTrades();
  }, []);

  return (
    <div className="flex flex-col px-8 mt-8">
      <TradeHistoryRowHeader />
      {tradeEvents.map((trade, index) => {
        return <TradeHistoryEvent key={index} trade={trade} />;
      })}
    </div>
  );
};

const filterAndReturnTradeEvents = (
  edges: any,
  realmEntityId: ID,
  eventType: EventType,
  indexOfInterest: number,
): TradeEvent[] => {
  return edges
    .filter((edge: any) => parseInt(edge.node.keys[indexOfInterest], 16) === Number(realmEntityId))
    .map((edge: any) => {
      return {
        type: eventType,
        event: {
          takerId: edge.node.keys[TAKER_INDEX],
          makerId: edge.node.keys[MAKER_INDEX],
          tradeId: edge.node.data[0],
          eventTime: new Date(parseInt(edge.node.data[1], 16) * 1000),
        },
      };
    });
};
