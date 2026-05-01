// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { BuildingType } from "@bibliothecadao/types";
import {
  clearAllBuildReservationState,
  getBuildReservationState,
  reserveOccupiedBuildSpot,
  toSpotKey,
} from "./build-reservation-store";
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
    clearAllBuildReservationState();
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

    expect(result).toBe(false);
    expect(placeBuilding).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Insufficient resources to build.");
  });

  it("keeps a successful auto-selected tile reserved until synced state confirms occupancy", async () => {
    const onReserveSpot = vi.fn();
    const onReleaseSpot = vi.fn();

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
      onReserveSpot,
      onReleaseSpot,
    });

    expect(result).toBe(true);
    expect(onReserveSpot).toHaveBeenCalledWith("11,10");
    expect(onReleaseSpot).not.toHaveBeenCalled();
  });

  it("keeps failed occupied candidates blocked before trying the next tile", async () => {
    const onReserveSpot = vi.fn();
    const onReleaseSpot = vi.fn();
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
      onReserveSpot,
      onReleaseSpot,
    });

    expect(result).toBe(true);
    expect(onReserveSpot).toHaveBeenNthCalledWith(1, "11,10");
    expect(onReserveSpot).toHaveBeenNthCalledWith(2, "11,11");
    expect(onReleaseSpot).not.toHaveBeenCalledWith("11,10");
    expect(onReleaseSpot).not.toHaveBeenCalledWith("11,11");
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

    expect(result).toBe(true);
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

    expect(result).toBe(true);
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

    await expect(resultPromise).resolves.toBe(true);
    expect(getBuildReservationState(101).occupied.has(toSpotKey({ col: 11, row: 10 }))).toBe(true);
  });

  it("assigns burst auto-build calls to distinct pending slots", async () => {
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

    expect([firstResult, secondResult]).toEqual([true, true]);
    expect(placeBuilding).toHaveBeenNthCalledWith(1, {}, 101, BuildingType.ResourceWheat, { col: 11, row: 10 }, true);
    expect(placeBuilding).toHaveBeenNthCalledWith(2, {}, 101, BuildingType.ResourceWheat, { col: 11, row: 11 }, true);
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

    expect(result).toBe(true);
    expect(placeBuilding).toHaveBeenCalledWith({}, 101, BuildingType.ResourceWheat, { col: 11, row: 11 }, true);
  });
});
