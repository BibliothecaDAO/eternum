// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { BuildingType } from "@bibliothecadao/types";
import {
  clearAllConstructionIntentState,
  getActiveConstructionIntents,
  getBuildReservationState,
  getPendingConstructionCost,
  reserveOccupiedBuildSpot,
  toSpotKey,
} from "./construction-intent-store";
import { buildRealmBuilding } from "./realm-build-actions";

const { placeBuilding, isHexOccupied, getBuildingCosts, getBalance, divideByPrecision, getBlockTimestamp, toastError } =
  vi.hoisted(() => ({
    placeBuilding: vi.fn(),
    isHexOccupied: vi.fn(),
    getBuildingCosts: vi.fn(),
    getBalance: vi.fn(),
    divideByPrecision: vi.fn((value: bigint | number) => Number(value)),
    getBlockTimestamp: vi.fn(() => ({ currentDefaultTick: 123 })),
    toastError: vi.fn(),
  }));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
  },
}));

vi.mock("@bibliothecadao/eternum", () => ({
  TileManager: vi.fn().mockImplementation(() => ({
    getRealmLevel: () => 1,
    isHexOccupied,
    placeBuilding,
  })),
  divideByPrecision,
  getBlockTimestamp,
  getBalance,
  getBuildingCosts,
}));

describe("buildRealmBuilding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllConstructionIntentState();
    isHexOccupied.mockReturnValue(false);
    placeBuilding.mockResolvedValue({ transaction_hash: "0x1" });
    getBuildingCosts.mockReturnValue([{ resource: 1, amount: 10 }]);
    getBalance.mockReturnValue({ balance: 20n, resourceId: 1 });
  });

  it("re-checks resource affordability before submitting a build", async () => {
    getBalance.mockReturnValueOnce({ balance: 5n, resourceId: 1 });

    const result = await buildRealmBuilding({
      entityId: 101,
      realmPosition: { x: 20, y: 30 },
      target: { type: BuildingType.ResourceWheat },
      useSimpleCost: true,
      world: {
        account: {},
        components: {},
        systemCalls: {},
      },
    });

    expect(result).toEqual({ ok: false, reason: "insufficient_resources" });
    expect(placeBuilding).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Insufficient resources to build.");
  });

  it("keeps a successful auto-selected intent active until indexed state reconciles it", async () => {
    const result = await buildRealmBuilding({
      entityId: 101,
      realmPosition: { x: 20, y: 30 },
      target: { type: BuildingType.ResourceWheat },
      useSimpleCost: true,
      world: {
        account: {},
        components: {},
        systemCalls: {},
      },
    });

    expect(result).toMatchObject({
      ok: true,
      selection: { outerCol: 20, outerRow: 30, innerCol: 11, innerRow: 10 },
      transactionHash: "0x1",
    });
    expect(getActiveConstructionIntents(101)).toHaveLength(1);
    expect(getPendingConstructionCost(101, 1 as any)).toBe(10);
    expect(getBuildReservationState(101).occupied.has(toSpotKey({ col: 11, row: 10 }))).toBe(true);
  });

  it("keeps failed occupied candidates blocked before trying the next tile", async () => {
    placeBuilding.mockRejectedValueOnce(new Error("space is occupied"));

    const result = await buildRealmBuilding({
      entityId: 101,
      realmPosition: { x: 20, y: 30 },
      target: { type: BuildingType.ResourceWheat },
      useSimpleCost: true,
      world: {
        account: {},
        components: {},
        systemCalls: {},
      },
    });

    expect(result).toMatchObject({ ok: true });
    expect(placeBuilding).toHaveBeenNthCalledWith(1, {}, 101, BuildingType.ResourceWheat, { col: 11, row: 10 }, true);
    expect(placeBuilding).toHaveBeenNthCalledWith(2, {}, 101, BuildingType.ResourceWheat, { col: 11, row: 11 }, true);
    expect(getBuildReservationState(101).occupied.has(toSpotKey({ col: 11, row: 10 }))).toBe(true);
    expect(getBuildReservationState(101).occupied.has(toSpotKey({ col: 11, row: 11 }))).toBe(true);
  });

  it("blocks occupied candidates in the shared store after a contract occupancy race", async () => {
    placeBuilding.mockRejectedValueOnce(new Error("space is occupied"));

    const result = await buildRealmBuilding({
      entityId: 101,
      realmPosition: { x: 20, y: 30 },
      target: { type: BuildingType.ResourceWheat },
      useSimpleCost: true,
      world: {
        account: {},
        components: {},
        systemCalls: {},
      },
    });

    expect(result).toMatchObject({ ok: true });
    expect(getBuildReservationState(101).occupied.has(toSpotKey({ col: 11, row: 10 }))).toBe(true);
    expect(getBuildReservationState(101).occupied.has(toSpotKey({ col: 11, row: 11 }))).toBe(true);
  });

  it("uses the shared reservation store when callers do not provide reservation hooks", async () => {
    const result = await buildRealmBuilding({
      entityId: 101,
      realmPosition: { x: 20, y: 30 },
      target: { type: BuildingType.ResourceWheat },
      useSimpleCost: true,
      world: {
        account: {},
        components: {},
        systemCalls: {},
      },
    });

    expect(result).toMatchObject({ ok: true });
    expect(getBuildReservationState(101).occupied.has(toSpotKey({ col: 11, row: 10 }))).toBe(true);
  });

  it("keeps provider-pending submissions reserved before transaction confirmation", async () => {
    let resolvePlacement: (result: { transaction_hash: string }) => void = () => {};
    placeBuilding.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePlacement = resolve;
      }),
    );

    const resultPromise = buildRealmBuilding({
      entityId: 101,
      realmPosition: { x: 20, y: 30 },
      target: { type: BuildingType.ResourceWheat },
      useSimpleCost: true,
      world: {
        account: {},
        components: {},
        systemCalls: {},
      },
    });

    expect(getBuildReservationState(101).occupied.has(toSpotKey({ col: 11, row: 10 }))).toBe(true);

    resolvePlacement({ transaction_hash: "0x1" });

    await expect(resultPromise).resolves.toMatchObject({ ok: true, transactionHash: "0x1" });
    expect(getBuildReservationState(101).occupied.has(toSpotKey({ col: 11, row: 10 }))).toBe(true);
  });

  it("blocks duplicate same-type burst auto-build calls while the first intent is active", async () => {
    const [firstResult, secondResult] = await Promise.all([
      buildRealmBuilding({
        entityId: 101,
        realmPosition: { x: 20, y: 30 },
        target: { type: BuildingType.ResourceWheat },
        useSimpleCost: true,
        world: {
          account: {},
          components: {},
          systemCalls: {},
        },
      }),
      buildRealmBuilding({
        entityId: 101,
        realmPosition: { x: 20, y: 30 },
        target: { type: BuildingType.ResourceWheat },
        useSimpleCost: true,
        world: {
          account: {},
          components: {},
          systemCalls: {},
        },
      }),
    ]);

    expect(firstResult).toMatchObject({ ok: true });
    expect(secondResult).toEqual({ ok: false, reason: "already_pending" });
    expect(placeBuilding).toHaveBeenCalledTimes(1);
    expect(placeBuilding).toHaveBeenCalledWith({}, 101, BuildingType.ResourceWheat, { col: 11, row: 10 }, true);
  });

  it("lets burst auto-builds for different types choose distinct tiles when resources cover both", async () => {
    const staleOccupiedSpots = new Set<string>();
    const staleVacatedSpots = new Set<string>();

    const [firstResult, secondResult] = await Promise.all([
      buildRealmBuilding({
        entityId: 101,
        realmPosition: { x: 20, y: 30 },
        target: { type: BuildingType.ResourceWheat },
        useSimpleCost: true,
        world: {
          account: {},
          components: {},
          systemCalls: {},
        },
        occupiedSpots: staleOccupiedSpots,
        vacatedSpots: staleVacatedSpots,
      }),
      buildRealmBuilding({
        entityId: 101,
        realmPosition: { x: 20, y: 30 },
        target: { type: BuildingType.ResourceFish },
        useSimpleCost: true,
        world: {
          account: {},
          components: {},
          systemCalls: {},
        },
        occupiedSpots: staleOccupiedSpots,
        vacatedSpots: staleVacatedSpots,
      }),
    ]);

    expect(firstResult).toMatchObject({
      ok: true,
      selection: { innerCol: 11, innerRow: 10 },
    });
    expect(secondResult).toMatchObject({
      ok: true,
      selection: { innerCol: 11, innerRow: 11 },
    });
    expect(placeBuilding).toHaveBeenNthCalledWith(1, {}, 101, BuildingType.ResourceWheat, { col: 11, row: 10 }, true);
    expect(placeBuilding).toHaveBeenNthCalledWith(2, {}, 101, BuildingType.ResourceFish, { col: 11, row: 11 }, true);
    expect(getPendingConstructionCost(101, 1 as any)).toBe(20);
  });

  it("skips shared reserved tiles when picking the next build spot", async () => {
    reserveOccupiedBuildSpot(101, { col: 11, row: 10 }, 1000);

    const result = await buildRealmBuilding({
      entityId: 101,
      realmPosition: { x: 20, y: 30 },
      target: { type: BuildingType.ResourceWheat },
      useSimpleCost: true,
      world: {
        account: {},
        components: {},
        systemCalls: {},
      },
    });

    expect(result).toMatchObject({ ok: true });
    expect(placeBuilding).toHaveBeenCalledWith({}, 101, BuildingType.ResourceWheat, { col: 11, row: 11 }, true);
  });
});
