// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { BuildingType, ResourcesIds } from "@bibliothecadao/types";
import {
  attachConstructionTx,
  beginConstructionIntent,
  clearAllConstructionIntentState,
  failConstructionIntent,
  getActiveConstructionIntents,
  getBuildReservationState,
  getConstructionIntentSnapshot,
  getEffectiveConstructionBalance,
  getEffectiveConstructionBalanceRaw,
  getPendingConstructionCost,
  hasActiveConstructionIntent,
  markConstructionIntentConfirmed,
  reconcileConstructionIntents,
} from "./construction-intent-store";

const { getBalance, divideByPrecision, multiplyByPrecision } = vi.hoisted(() => ({
  getBalance: vi.fn(),
  divideByPrecision: vi.fn((value: bigint | number, floor: boolean = true) => {
    const normalized = Number(value) / 1_000_000_000;
    return floor ? Math.floor(normalized) : normalized;
  }),
  multiplyByPrecision: vi.fn((value: number) => Math.floor(value * 1_000_000_000)),
}));

vi.mock("@bibliothecadao/eternum", () => ({
  divideByPrecision,
  getBalance,
  multiplyByPrecision,
}));

describe("construction-intent-store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllConstructionIntentState();
    vi.useRealTimers();
  });

  it("begins one active construction intent per realm and building type", () => {
    const firstIntent = beginConstructionIntent({
      realmEntityId: 101,
      buildingType: BuildingType.ResourceWheat,
      spot: { col: 11, row: 10 },
      useSimpleCost: true,
      costs: [{ resource: ResourcesIds.Wheat, amount: 10 }],
      now: 1000,
    });

    const duplicateIntent = beginConstructionIntent({
      realmEntityId: 101,
      buildingType: BuildingType.ResourceWheat,
      spot: { col: 11, row: 11 },
      useSimpleCost: true,
      costs: [{ resource: ResourcesIds.Wheat, amount: 10 }],
      now: 1000,
    });

    const otherBuildingIntent = beginConstructionIntent({
      realmEntityId: 101,
      buildingType: BuildingType.ResourceFish,
      spot: { col: 10, row: 11 },
      useSimpleCost: true,
      costs: [{ resource: ResourcesIds.Fish, amount: 5 }],
      now: 1000,
    });

    expect(firstIntent).not.toBeNull();
    expect(duplicateIntent).toBeNull();
    expect(otherBuildingIntent).not.toBeNull();
    expect(hasActiveConstructionIntent(101, BuildingType.ResourceWheat)).toBe(true);
    expect(hasActiveConstructionIntent(101, BuildingType.ResourceFish)).toBe(true);
  });

  it("allows multiple same-type intents when the caller only needs per-tile exclusivity", () => {
    const firstIntent = beginConstructionIntent({
      realmEntityId: 101,
      buildingType: BuildingType.ResourceWheat,
      spot: { col: 11, row: 10 },
      useSimpleCost: true,
      costs: [{ resource: ResourcesIds.Wheat, amount: 10 }],
      now: 1000,
      enforceBuildingTypeUniqueness: false,
    });

    const secondIntent = beginConstructionIntent({
      realmEntityId: 101,
      buildingType: BuildingType.ResourceWheat,
      spot: { col: 11, row: 11 },
      useSimpleCost: true,
      costs: [{ resource: ResourcesIds.Wheat, amount: 10 }],
      now: 1001,
      enforceBuildingTypeUniqueness: false,
    });

    expect(firstIntent).not.toBeNull();
    expect(secondIntent).not.toBeNull();
    expect(getActiveConstructionIntents(101)).toHaveLength(2);
    expect(getBuildReservationState(101).occupied).toEqual(new Set(["11,10", "11,11"]));
  });

  it("derives pending costs and occupied tiles from active intents", () => {
    beginConstructionIntent({
      realmEntityId: 101,
      buildingType: BuildingType.ResourceWheat,
      spot: { col: 11, row: 10 },
      useSimpleCost: true,
      costs: [
        { resource: ResourcesIds.Wheat, amount: 10 },
        { resource: ResourcesIds.Wood, amount: 3 },
      ],
      now: 1000,
    });
    beginConstructionIntent({
      realmEntityId: 101,
      buildingType: BuildingType.ResourceFish,
      spot: { col: 11, row: 11 },
      useSimpleCost: true,
      costs: [{ resource: ResourcesIds.Wheat, amount: 4 }],
      now: 1000,
    });

    expect(getPendingConstructionCost(101, ResourcesIds.Wheat)).toBe(14);
    expect(getPendingConstructionCost(101, ResourcesIds.Wood)).toBe(3);
    expect(getBuildReservationState(101).occupied).toEqual(new Set(["11,10", "11,11"]));
  });

  it("keeps confirmed intents active until indexed state settles", () => {
    const intent = beginConstructionIntent({
      realmEntityId: 101,
      buildingType: BuildingType.ResourceWheat,
      spot: { col: 11, row: 10 },
      useSimpleCost: true,
      costs: [{ resource: ResourcesIds.Wheat, amount: 10 }],
      now: 1000,
    });
    expect(intent).not.toBeNull();

    attachConstructionTx(intent!.intentId, "0xabc");
    markConstructionIntentConfirmed("0xabc");

    reconcileConstructionIntents(
      101,
      () => true,
      ({ col, row }) => (col === 11 && row === 10 ? { category: BuildingType.ResourceWheat } : undefined),
      { now: 2000, settleMs: 3000 },
    );

    expect(getActiveConstructionIntents(101)[0]?.status).toBe("indexed_settling");
    expect(getPendingConstructionCost(101, ResourcesIds.Wheat)).toBe(10);

    reconcileConstructionIntents(
      101,
      () => true,
      ({ col, row }) => (col === 11 && row === 10 ? { category: BuildingType.ResourceWheat } : undefined),
      { now: 5000, settleMs: 3000 },
    );

    expect(getActiveConstructionIntents(101)).toEqual([]);
    expect(getPendingConstructionCost(101, ResourcesIds.Wheat)).toBe(0);
  });

  it("lets indexed state settle submitted intents before tx confirmation callbacks arrive", () => {
    const intent = beginConstructionIntent({
      realmEntityId: 101,
      buildingType: BuildingType.ResourceWheat,
      spot: { col: 11, row: 10 },
      useSimpleCost: true,
      costs: [{ resource: ResourcesIds.Wheat, amount: 10 }],
      now: 1000,
    });
    expect(intent).not.toBeNull();

    attachConstructionTx(intent!.intentId, "0xabc", 1100);

    reconcileConstructionIntents(
      101,
      () => true,
      ({ col, row }) => (col === 11 && row === 10 ? { category: BuildingType.ResourceWheat } : undefined),
      { now: 2000, settleMs: 3000 },
    );

    expect(getActiveConstructionIntents(101)[0]?.status).toBe("indexed_settling");
    expect(getPendingConstructionCost(101, ResourcesIds.Wheat)).toBe(10);

    reconcileConstructionIntents(
      101,
      () => true,
      ({ col, row }) => (col === 11 && row === 10 ? { category: BuildingType.ResourceWheat } : undefined),
      { now: 5000, settleMs: 3000 },
    );

    expect(getActiveConstructionIntents(101)).toEqual([]);
    expect(getPendingConstructionCost(101, ResourcesIds.Wheat)).toBe(0);
  });

  it("ignores late confirmation callbacks after an intent is already indexed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);

    const intent = beginConstructionIntent({
      realmEntityId: 101,
      buildingType: BuildingType.ResourceWheat,
      spot: { col: 11, row: 10 },
      useSimpleCost: true,
      costs: [{ resource: ResourcesIds.Wheat, amount: 10 }],
    });
    expect(intent).not.toBeNull();

    attachConstructionTx(intent!.intentId, "0xabc");

    reconcileConstructionIntents(
      101,
      () => true,
      ({ col, row }) => (col === 11 && row === 10 ? { category: BuildingType.ResourceWheat } : undefined),
      { now: 2000 },
    );

    expect(getActiveConstructionIntents(101)[0]?.status).toBe("indexed_settling");

    markConstructionIntentConfirmed("0xabc", 2500);

    expect(getActiveConstructionIntents(101)[0]?.status).toBe("indexed_settling");

    vi.setSystemTime(5000);
    vi.advanceTimersByTime(3000);

    expect(getActiveConstructionIntents(101)).toEqual([]);
  });

  it("keeps confirmed intents active after the settle window until indexed state arrives", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);

    const intent = beginConstructionIntent({
      realmEntityId: 101,
      buildingType: BuildingType.ResourceWheat,
      spot: { col: 11, row: 10 },
      useSimpleCost: true,
      costs: [{ resource: ResourcesIds.Wheat, amount: 10 }],
    });
    expect(intent).not.toBeNull();

    attachConstructionTx(intent!.intentId, "0xabc");
    markConstructionIntentConfirmed("0xabc");

    vi.setSystemTime(5000);

    expect(hasActiveConstructionIntent(101, BuildingType.ResourceWheat)).toBe(true);
    expect(getPendingConstructionCost(101, ResourcesIds.Wheat)).toBe(10);
    expect(
      beginConstructionIntent({
        realmEntityId: 101,
        buildingType: BuildingType.ResourceWheat,
        spot: { col: 11, row: 11 },
        useSimpleCost: true,
        costs: [{ resource: ResourcesIds.Wheat, amount: 10 }],
      }),
    ).toBeNull();
  });

  it("auto-reaps indexed intents after the settle window and notifies listeners without another reconcile", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);

    const intent = beginConstructionIntent({
      realmEntityId: 101,
      buildingType: BuildingType.ResourceWheat,
      spot: { col: 11, row: 10 },
      useSimpleCost: true,
      costs: [{ resource: ResourcesIds.Wheat, amount: 10 }],
    });
    expect(intent).not.toBeNull();

    attachConstructionTx(intent!.intentId, "0xabc");
    markConstructionIntentConfirmed("0xabc");

    reconcileConstructionIntents(
      101,
      () => true,
      ({ col, row }) => (col === 11 && row === 10 ? { category: BuildingType.ResourceWheat } : undefined),
      { now: 2000 },
    );

    const snapshotBeforeSettle = getConstructionIntentSnapshot();

    vi.setSystemTime(4999);
    vi.advanceTimersByTime(2999);

    expect(getConstructionIntentSnapshot()).toBe(snapshotBeforeSettle);
    expect(hasActiveConstructionIntent(101, BuildingType.ResourceWheat)).toBe(true);
    expect(getPendingConstructionCost(101, ResourcesIds.Wheat)).toBe(10);

    vi.setSystemTime(5000);
    vi.advanceTimersByTime(1);

    expect(getConstructionIntentSnapshot()).toBeGreaterThan(snapshotBeforeSettle);
    expect(hasActiveConstructionIntent(101, BuildingType.ResourceWheat)).toBe(false);
    expect(getPendingConstructionCost(101, ResourcesIds.Wheat)).toBe(0);
  });

  it("releases non-occupancy failures immediately", () => {
    const intent = beginConstructionIntent({
      realmEntityId: 101,
      buildingType: BuildingType.ResourceWheat,
      spot: { col: 11, row: 10 },
      useSimpleCost: true,
      costs: [{ resource: ResourcesIds.Wheat, amount: 10 }],
      now: 1000,
    });

    expect(failConstructionIntent({ intentId: intent!.intentId, reason: "insufficient resources" })).toBe(true);
    expect(getActiveConstructionIntents(101)).toEqual([]);
    expect(getPendingConstructionCost(101, ResourcesIds.Wheat)).toBe(0);
    expect(getBuildReservationState(101).occupied.has("11,10")).toBe(false);
  });

  it("keeps occupied-race failures as tile holds until indexed state or stale timeout resolves", () => {
    const intent = beginConstructionIntent({
      realmEntityId: 101,
      buildingType: BuildingType.ResourceWheat,
      spot: { col: 11, row: 10 },
      useSimpleCost: true,
      costs: [{ resource: ResourcesIds.Wheat, amount: 10 }],
      now: 1000,
    });

    expect(failConstructionIntent({ intentId: intent!.intentId, reason: "space is occupied", now: 1100 })).toBe(true);
    expect(getActiveConstructionIntents(101)).toEqual([]);
    expect(getPendingConstructionCost(101, ResourcesIds.Wheat)).toBe(0);
    expect(getBuildReservationState(101).occupied.has("11,10")).toBe(true);

    reconcileConstructionIntents(
      101,
      () => false,
      () => undefined,
      {
        now: 2000,
        staleMs: 90_000,
      },
    );
    expect(getBuildReservationState(101).occupied.has("11,10")).toBe(true);

    reconcileConstructionIntents(
      101,
      () => false,
      () => undefined,
      {
        now: 91_101,
        staleMs: 90_000,
      },
    );
    expect(getBuildReservationState(101).occupied.has("11,10")).toBe(false);
  });

  it("subtracts active construction costs from effective balance", () => {
    getBalance.mockReturnValue({ balance: 30_000_000_000, resourceId: ResourcesIds.Wheat });
    beginConstructionIntent({
      realmEntityId: 101,
      buildingType: BuildingType.ResourceWheat,
      spot: { col: 11, row: 10 },
      useSimpleCost: true,
      costs: [{ resource: ResourcesIds.Wheat, amount: 10 }],
      now: 1000,
    });

    expect(getEffectiveConstructionBalance(101, ResourcesIds.Wheat, 123, {} as any)).toBe(20);
  });

  it("preserves fractional spendable balance before subtracting pending construction cost", () => {
    getBalance.mockReturnValue({ balance: 1_900_000_000, resourceId: ResourcesIds.Lords });
    beginConstructionIntent({
      realmEntityId: 101,
      buildingType: BuildingType.ResourceWheat,
      spot: { col: 11, row: 10 },
      useSimpleCost: true,
      costs: [{ resource: ResourcesIds.Lords, amount: 1 }],
      now: 1000,
    });

    expect(getEffectiveConstructionBalance(101, ResourcesIds.Lords, 123, {} as any)).toBeCloseTo(0.9, 10);
  });

  it("clamps effective balances at zero when pending construction exceeds the canonical balance", () => {
    getBalance.mockReturnValue({ balance: 5_000_000_000, resourceId: ResourcesIds.Wheat });
    beginConstructionIntent({
      realmEntityId: 101,
      buildingType: BuildingType.ResourceWheat,
      spot: { col: 11, row: 10 },
      useSimpleCost: true,
      costs: [{ resource: ResourcesIds.Wheat, amount: 10 }],
      now: 1000,
    });

    expect(getEffectiveConstructionBalance(101, ResourcesIds.Wheat, 123, {} as any)).toBe(0);
    expect(getEffectiveConstructionBalanceRaw(101, ResourcesIds.Wheat, 123, {} as any)).toBe(0);
  });
});
