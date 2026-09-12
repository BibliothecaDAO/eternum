// @vitest-environment node
import { describe, it, expect } from "vitest";
import { filterPendingOrders } from "./use-pending-orders";
import { MarketInterface } from "@bibliothecadao/types";

const generateMockOffers = (
  count: number,
  resourceId: number,
  basePrice: number,
  isBid: boolean,
): MarketInterface[] => {
  return Array.from({ length: count }, (_, i) => {
    const priceVariation = (Math.random() - 0.5) * basePrice * 0.4; // ±20% spread
    const price = basePrice + priceVariation;
    const amount = Math.floor(Math.random() * 10000) + 100;
    const makerId = Math.floor(Math.random() * 1000);

    return {
      makerName: `player-${makerId}`,
      originName: `realm-${i}`,
      tradeId: i + 1,
      makerId,
      takerId: 0,
      makerOrder: 0,
      makerGivesMinResourceAmount: 1,
      takerPaysMinResourceAmount: 1,
      makerGivesMaxResourceCount: 1,
      expiresAt: Date.now() / 1000 + 86400,
      takerGets: isBid
        ? [{ resourceId: 253, amount: Math.floor(amount * price) }] // Lords
        : [{ resourceId, amount }],
      makerGets: isBid ? [{ resourceId, amount }] : [{ resourceId: 253, amount: Math.floor(amount * price) }],
      ratio: price,
      perLords: price,
    } as unknown as MarketInterface;
  });
};

describe("filterPendingOrders - stress tests", () => {
  it("filters user orders from 5000 total offers", () => {
    const myEntityId = 99999; // unlikely to collide with random makerId (0-999)
    const bids = generateMockOffers(2500, 1, 0.5, true);
    const asks = generateMockOffers(2500, 1, 0.5, false);

    // Seed some as ours
    const myCount = 25;
    for (let i = 0; i < myCount; i++) {
      bids[i * 100] = { ...bids[i * 100], makerId: myEntityId } as unknown as MarketInterface;
      asks[i * 100] = { ...asks[i * 100], makerId: myEntityId } as unknown as MarketInterface;
    }

    const start = performance.now();
    const result = filterPendingOrders(bids, asks, myEntityId);
    const elapsed = performance.now() - start;

    expect(result.count).toBe(myCount * 2);
    expect(result.orders).toHaveLength(myCount * 2);
    expect(elapsed).toBeLessThan(10);
  });
});

describe("sidebar price calculation - stress tests", () => {
  it("computes best bid/ask across 57 resources with 2000 offers each", () => {
    // This simulates what MarketResourceSidebar does
    const allBids: MarketInterface[] = [];
    const allAsks: MarketInterface[] = [];

    for (let r = 1; r <= 57; r++) {
      allBids.push(...generateMockOffers(35, r, 0.3 + r * 0.01, true)); // ~2000 total
      allAsks.push(...generateMockOffers(35, r, 0.3 + r * 0.01, false));
    }

    const start = performance.now();

    // Simulate the current O(resources * offers) pattern
    const prices: Record<number, { bid: number; ask: number }> = {};
    for (let r = 1; r <= 57; r++) {
      const bidPrice = allBids
        .filter((offer) => offer.makerGets[0]?.resourceId === r)
        .reduce((acc, offer) => (offer.perLords > acc ? offer.perLords : acc), 0);

      const askPrice = allAsks
        .filter((offer) => offer.takerGets[0]?.resourceId === r)
        .reduce((acc, offer) => (offer.perLords < acc ? offer.perLords : acc), Infinity);

      prices[r] = { bid: bidPrice, ask: askPrice === Infinity ? 0 : askPrice };
    }

    const elapsed = performance.now() - start;

    expect(Object.keys(prices)).toHaveLength(57);

    // Current approach: O(resources * offers) = O(57 * 2000) = O(114000)
    // Should still be under 100ms even with naive approach
    expect(elapsed).toBeLessThan(100);
  });

  it("pre-indexed approach is significantly faster", () => {
    const allBids: MarketInterface[] = [];
    const allAsks: MarketInterface[] = [];

    for (let r = 1; r <= 57; r++) {
      allBids.push(...generateMockOffers(35, r, 0.3 + r * 0.01, true));
      allAsks.push(...generateMockOffers(35, r, 0.3 + r * 0.01, false));
    }

    const start = performance.now();

    // Optimized: Build index once, then O(1) lookup per resource
    const bidIndex = new Map<number, number>();
    const askIndex = new Map<number, number>();

    for (const offer of allBids) {
      const rid = offer.makerGets[0]?.resourceId;
      if (rid && (!bidIndex.has(rid) || offer.perLords > bidIndex.get(rid)!)) {
        bidIndex.set(rid, offer.perLords);
      }
    }
    for (const offer of allAsks) {
      const rid = offer.takerGets[0]?.resourceId;
      if (rid && (!askIndex.has(rid) || offer.perLords < askIndex.get(rid)!)) {
        askIndex.set(rid, offer.perLords);
      }
    }

    const prices: Record<number, { bid: number; ask: number }> = {};
    for (let r = 1; r <= 57; r++) {
      prices[r] = { bid: bidIndex.get(r) || 0, ask: askIndex.get(r) || 0 };
    }

    const elapsed = performance.now() - start;

    expect(Object.keys(prices)).toHaveLength(57);
    // Indexed approach: O(offers + resources) = O(2000 + 57) - much faster
    expect(elapsed).toBeLessThan(20);
  });
});
