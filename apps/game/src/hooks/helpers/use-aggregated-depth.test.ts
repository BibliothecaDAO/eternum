// @vitest-environment node
import { describe, it, expect } from "vitest";
import { aggregateOrders, AggregatedLevel } from "./use-aggregated-depth";
import { MarketInterface } from "@bibliothecadao/types";

interface MakeOfferParams {
  perLords: number;
  makerId: number;
  takerGetsAmount?: number;
  makerGetsAmount?: number;
}

const makeOffer = (params: MakeOfferParams): MarketInterface =>
  ({
    makerName: "test",
    originName: "test",
    tradeId: Math.random() * 1000,
    makerId: params.makerId,
    takerId: 0,
    makerOrder: 0,
    makerGivesMinResourceAmount: 1,
    takerPaysMinResourceAmount: 1,
    makerGivesMaxResourceCount: 1,
    expiresAt: Date.now() + 86400,
    takerGets: [{ resourceId: 1, amount: params.takerGetsAmount ?? 100 }],
    makerGets: [{ resourceId: 2, amount: params.makerGetsAmount ?? 50 }],
    ratio: 1,
    perLords: params.perLords,
  }) as unknown as MarketInterface;

describe("aggregateOrders", () => {
  it("returns empty array for no offers", () => {
    const result = aggregateOrders([], 1);
    expect(result).toEqual([]);
  });

  it("groups orders at the same price level", () => {
    const offers = [
      makeOffer({ perLords: 0.45, makerId: 10, takerGetsAmount: 100 }),
      makeOffer({ perLords: 0.45, makerId: 20, takerGetsAmount: 200 }),
      makeOffer({ perLords: 0.5, makerId: 30, takerGetsAmount: 150 }),
    ];

    const result = aggregateOrders(offers, 1);

    expect(result).toHaveLength(2);

    const level045 = result.find((l) => l.price === 0.45);
    const level050 = result.find((l) => l.price === 0.5);

    expect(level045).toBeDefined();
    expect(level045!.orderCount).toBe(2);
    expect(level045!.totalVolume).toBe(300);

    expect(level050).toBeDefined();
    expect(level050!.orderCount).toBe(1);
    expect(level050!.totalVolume).toBe(150);
  });

  it("marks levels with own orders", () => {
    const myEntityId = 42;
    const offers = [
      makeOffer({ perLords: 0.45, makerId: myEntityId, takerGetsAmount: 100 }),
      makeOffer({ perLords: 0.45, makerId: 10, takerGetsAmount: 200 }),
      makeOffer({ perLords: 0.5, makerId: 20, takerGetsAmount: 150 }),
    ];

    const result = aggregateOrders(offers, myEntityId);

    const level045 = result.find((l) => l.price === 0.45);
    const level050 = result.find((l) => l.price === 0.5);

    expect(level045!.hasOwnOrders).toBe(true);
    expect(level050!.hasOwnOrders).toBe(false);
  });

  it("calculates depth percentages correctly", () => {
    const offers = [
      makeOffer({ perLords: 0.45, makerId: 1, takerGetsAmount: 100 }),
      makeOffer({ perLords: 0.5, makerId: 2, takerGetsAmount: 200 }),
    ];

    const result = aggregateOrders(offers, 1);

    const level045 = result.find((l) => l.price === 0.45);
    const level050 = result.find((l) => l.price === 0.5);

    // max volume is 200, so 200/200 = 100%, 100/200 = 50%
    expect(level050!.depthPercent).toBe(100);
    expect(level045!.depthPercent).toBe(50);
  });

  it("sorts by price descending", () => {
    const offers = [
      makeOffer({ perLords: 0.3, makerId: 1, takerGetsAmount: 100 }),
      makeOffer({ perLords: 0.5, makerId: 2, takerGetsAmount: 100 }),
      makeOffer({ perLords: 0.4, makerId: 3, takerGetsAmount: 100 }),
    ];

    const result = aggregateOrders(offers, 1);

    expect(result[0].price).toBe(0.5);
    expect(result[1].price).toBe(0.4);
    expect(result[2].price).toBe(0.3);
  });
});
