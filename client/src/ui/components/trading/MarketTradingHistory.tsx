import { client } from "@/dojo/events/graphqlClient";
import { ACCEPT_ORDER_EVENT, CANCEL_ORDER_EVENT, CREATE_ORDER_EVENT } from "@bibliothecadao/eternum";
import { useEffect, useState } from "react";
import { EventType, TradeHistoryEvent, TradeHistoryRowHeader } from "./TradeHistoryEvent";

interface MarketTradingHistoryProps {
  realmEntityId: bigint;
}

export type TradeEvent = {
  eventTime: Date;
  eventType: EventType;
  expires_at: bigint;
  maker_gives_resources_hash: string;
  maker_gives_resources_id: bigint;
  maker_gives_resources_weight: bigint;
  maker_id: bigint;
  taker_gives_resources_hash: string;
  taker_gives_resources_id: bigint;
  taker_gives_resources_weight: bigint;
  taker_id: bigint;
  trade_id: bigint;
};

export const MarketTradingHistory = ({ realmEntityId }: MarketTradingHistoryProps) => {
  const [tradeEvents, setTradeEvents] = useState<TradeEvent[]>([]);

  const queryTrades = async () => {
    const trades: any = await client.request(`
	query {
		tradeModels1: tradeModels (order: {direction: DESC, field: EXPIRES_AT}, where: {maker_id: "49"}){
		  edges {
			node {
			  entity {
				createdAt
				updatedAt
				executedAt
			  }
			}
		  }
		},
		tradeModels (order: {direction: DESC, field: EXPIRES_AT}, where: {taker_id: "49"}){
		  edges {
			node {
			  entity {
				createdAt
				updatedAt
				executedAt
			  }
			}
		  }
		},
	  }  `);

    const tradeHistory: TradeEvent[] = [];
    trades.createdOrders.edges.forEach((edge: any) => {
      tradeHistory.push(
        toriiDataToTradeEvent(edge.node, new Date(edge.node.entity.createdAt), EventType.ORDER_CREATED),
      );
      if (edge.node.entity.executedAt !== edge.node.entity.createdAt) {
        if (parseInt(edge.node.taker_id, 16) !== 0) {
          tradeHistory.push(
            toriiDataToTradeEvent(edge.node, new Date(edge.node.entity.executedAt), EventType.ORDER_ACCEPTED),
          );
        } else {
          tradeHistory.push(
            toriiDataToTradeEvent(edge.node, new Date(edge.node.entity.executedAt), EventType.ORDER_CANCELLED),
          );
        }
      }
    });
    trades.myTrades.edges.forEach((edge: any) => {
      tradeHistory.push(toriiDataToTradeEvent(edge.node, new Date(edge.node.entity.executedAt), EventType.BOUGHT));
    });
    tradeHistory.sort((a: TradeEvent, b: TradeEvent) => b.eventTime.getTime() - a.eventTime.getTime());
    setTradeEvents(tradeHistory);
  };

  useEffect(() => {
    queryTrades();
  }, []);

  return (
    <div className="flex flex-col px-8 mt-8">
      <TradeHistoryRowHeader />
      {tradeEvents.map((trade) => {
        return <TradeHistoryEvent trade={trade} />;
      })}
    </div>
  );
};

const toriiDataToTradeEvent = (trade: any, eventTime: Date, tradeStatus: EventType): TradeEvent => {
  return {
    eventTime: eventTime,
    eventType: tradeStatus,
    expires_at: BigInt(trade.expires_at),
    maker_gives_resources_id: BigInt(trade.maker_gives_resources_id),
    taker_gives_resources_id: BigInt(trade.taker_gives_resources_id),
    maker_gives_resources_weight: BigInt(trade.maker_gives_resources_weight),
    taker_gives_resources_weight: BigInt(trade.taker_gives_resources_weight),
    taker_id: BigInt(trade.taker_id),
    maker_id: BigInt(trade.maker_id),
    trade_id: BigInt(trade.trade_id),
    maker_gives_resources_hash: trade.maker_gives_resources_hash,
    taker_gives_resources_hash: trade.taker_gives_resources_hash,
  };
};
