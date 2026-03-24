// @vitest-environment node
import { describe, it, expect } from "vitest";
import { filterPendingOrders } from "./use-pending-orders";
import { MarketInterface } from "@bibliothecadao/types";

const makeOffer = (makerId: number, lordsAmount: number): MarketInterface =>
  ({
    makerName: "test",
    originName: "test",
    tradeId: Math.random() * 1000,
    makerId,
    takerId: 0,
    makerOrder: 0,
    makerGivesMinResourceAmount: 1,
    takerPaysMinResourceAmount: 1,
    makerGivesMaxResourceCount: 1,
    expiresAt: Date.now() + 86400,
    takerGets: [{ resourceId: 1, amount: 100 }],
    makerGets: [{ resourceId: 2, amount: lordsAmount }],
    ratio: 1,
    perLords: 0.5,
  }) as unknown as MarketInterface;

describe("filterPendingOrders", () => {
  const myEntityId = 42;

  it("returns zero when no orders match", () => {
    const bids = [makeOffer(10, 100)];
    const asks = [makeOffer(20, 200)];

    const result = filterPendingOrders(bids, asks, myEntityId);

    expect(result.count).toBe(0);
    expect(result.totalLordsLocked).toBe(0);
    expect(result.orders).toHaveLength(0);
  });

  it("counts orders from both bids and asks", () => {
    const bids = [makeOffer(myEntityId, 100), makeOffer(10, 50)];
    const asks = [makeOffer(myEntityId, 200), makeOffer(myEntityId, 300)];

    const result = filterPendingOrders(bids, asks, myEntityId);

    expect(result.count).toBe(3);
    expect(result.orders).toHaveLength(3);
  });

  it("sums Lords locked from bid orders", () => {
    const bids = [makeOffer(myEntityId, 100), makeOffer(myEntityId, 250)];
    const asks: MarketInterface[] = [];

    const result = filterPendingOrders(bids, asks, myEntityId);

    expect(result.totalLordsLocked).toBe(350);
  });

  it("handles empty offer arrays", () => {
    const result = filterPendingOrders([], [], myEntityId);

    expect(result.count).toBe(0);
    expect(result.totalLordsLocked).toBe(0);
    expect(result.orders).toHaveLength(0);
  });
});
