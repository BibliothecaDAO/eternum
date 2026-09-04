import { MarketInterface } from "@bibliothecadao/types";
import { useMemo } from "react";

export interface AggregatedLevel {
  price: number;
  totalVolume: number;
  orderCount: number;
  hasOwnOrders: boolean;
  depthPercent: number;
  orders: MarketInterface[];
}

export const aggregateOrders = (
  offers: MarketInterface[],
  entityId: number,
  pricePrecision: number = 4,
): AggregatedLevel[] => {
  if (offers.length === 0) return [];

  // Group by rounded price
  const groups = new Map<string, { orders: MarketInterface[]; totalVolume: number; hasOwnOrders: boolean }>();

  for (const offer of offers) {
    const priceKey = offer.perLords.toFixed(pricePrecision);
    const existing = groups.get(priceKey) || { orders: [], totalVolume: 0, hasOwnOrders: false };
    existing.orders.push(offer);
    existing.totalVolume += offer.takerGets[0]?.amount || offer.makerGets[0]?.amount || 0;
    if (offer.makerId === entityId) {
      existing.hasOwnOrders = true;
    }
    groups.set(priceKey, existing);
  }

  const levels: AggregatedLevel[] = [];
  let maxVolume = 0;

  for (const [priceKey, group] of groups) {
    if (group.totalVolume > maxVolume) maxVolume = group.totalVolume;
    levels.push({
      price: parseFloat(priceKey),
      totalVolume: group.totalVolume,
      orderCount: group.orders.length,
      hasOwnOrders: group.hasOwnOrders,
      depthPercent: 0, // calculated below
      orders: group.orders,
    });
  }

  // Calculate depth percentages
  for (const level of levels) {
    level.depthPercent = maxVolume > 0 ? (level.totalVolume / maxVolume) * 100 : 0;
  }

  // Sort by price descending
  levels.sort((a, b) => b.price - a.price);

  return levels;
};

export const useAggregatedDepth = (
  offers: MarketInterface[],
  entityId: number,
  pricePrecision: number = 4,
): AggregatedLevel[] => {
  return useMemo(() => aggregateOrders(offers, entityId, pricePrecision), [offers, entityId, pricePrecision]);
};
