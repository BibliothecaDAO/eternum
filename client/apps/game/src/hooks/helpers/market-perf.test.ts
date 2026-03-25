// @vitest-environment node
import { describe, it, expect } from "vitest";
import { comparePrices } from "./use-best-price";
import { aggregateOrders } from "./use-aggregated-depth";
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

describe("comparePrices - stress tests", () => {
  it("handles 1000 ask offers correctly", () => {
    const asks = generateMockOffers(1000, 1, 0.5, false);
    const start = performance.now();

    const result = comparePrices({
      direction: "buy",
      askOffers: asks,
      bidOffers: [],
      resourceId: 1,
      ammSpotPrice: 0.48,
      ammSlippage: 1.0,
    });

    const elapsed = performance.now() - start;

    // Correctness: should find the lowest ask price
    expect(result.obPrice).toBeDefined();
    expect(result.obPrice).toBeLessThanOrEqual(0.6); // base 0.5 + 20% max
    expect(result.bestVenue).toBeDefined();

    // Performance: should complete in < 10ms
    expect(elapsed).toBeLessThan(10);
  });

  it("handles 5000 mixed offers across multiple resources", () => {
    // Generate offers for 5 different resources
    const asks: MarketInterface[] = [];
    const bids: MarketInterface[] = [];
    for (let r = 1; r <= 5; r++) {
      asks.push(...generateMockOffers(1000, r, 0.3 + r * 0.1, false));
      bids.push(...generateMockOffers(1000, r, 0.3 + r * 0.1, true));
    }

    const start = performance.now();

    // Compare for resource 3
    const result = comparePrices({
      direction: "buy",
      askOffers: asks,
      bidOffers: bids,
      resourceId: 3,
      ammSpotPrice: 0.55,
      ammSlippage: 0.5,
    });

    const elapsed = performance.now() - start;

    expect(result.obPrice).toBeDefined();
    expect(elapsed).toBeLessThan(50); // 10k total offers, should still be fast
  });

  it("handles 0 offers for target resource among 2000 other offers", () => {
    const asks = generateMockOffers(2000, 5, 0.5, false); // all for resource 5

    const result = comparePrices({
      direction: "buy",
      askOffers: asks,
      bidOffers: [],
      resourceId: 1, // resource 1 has 0 offers
      ammSpotPrice: 0.5,
      ammSlippage: 0,
    });

    expect(result.obPrice).toBeNull();
    expect(result.bestVenue).toBe("amm");
  });
});

describe("aggregateOrders - stress tests", () => {
  it("aggregates 1000 orders into price levels", () => {
    const offers = generateMockOffers(1000, 1, 0.5, false);

    const start = performance.now();
    const result = aggregateOrders(offers, 42);
    const elapsed = performance.now() - start;

    // Correctness: should have fewer levels than orders (grouped by price)
    expect(result.length).toBeLessThan(1000);
    expect(result.length).toBeGreaterThan(0);

    // All volumes should be positive
    result.forEach((level) => {
      expect(level.totalVolume).toBeGreaterThan(0);
      expect(level.orderCount).toBeGreaterThan(0);
      expect(level.depthPercent).toBeGreaterThanOrEqual(0);
      expect(level.depthPercent).toBeLessThanOrEqual(100);
    });

    // Should be sorted by price descending
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].price).toBeGreaterThanOrEqual(result[i].price);
    }

    // Performance
    expect(elapsed).toBeLessThan(20);
  });

  it("handles 5000 orders efficiently", () => {
    const offers = generateMockOffers(5000, 1, 0.5, false);

    const start = performance.now();
    const result = aggregateOrders(offers, 42);
    const elapsed = performance.now() - start;

    expect(result.length).toBeGreaterThan(0);

    // Total volume across all levels should equal sum of individual offer volumes
    const totalAggregatedVolume = result.reduce((sum, l) => sum + l.totalVolume, 0);
    const totalOriginalVolume = offers.reduce((sum, o) => sum + (o.takerGets[0]?.amount || 0), 0);
    expect(totalAggregatedVolume).toBe(totalOriginalVolume);

    expect(elapsed).toBeLessThan(50);
  });

  it("correctly identifies own orders among 2000", () => {
    const myEntityId = 99999; // unlikely to collide with random makerId (0-999)
    const offers = generateMockOffers(2000, 1, 0.5, false);
    // Insert some of our own offers
    for (let i = 0; i < 50; i++) {
      offers[i * 40] = { ...offers[i * 40], makerId: myEntityId } as unknown as MarketInterface;
    }

    const result = aggregateOrders(offers, myEntityId);

    const levelsWithOwnOrders = result.filter((l) => l.hasOwnOrders);
    expect(levelsWithOwnOrders.length).toBeGreaterThan(0);
    expect(levelsWithOwnOrders.length).toBeLessThanOrEqual(50);
  });
});

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
