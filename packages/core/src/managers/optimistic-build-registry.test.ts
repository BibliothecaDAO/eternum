import { BuildingType } from "@bibliothecadao/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetOptimisticBuildRegistryForTests,
  getPendingOptimisticBuildCountForStructureAndType,
  hasPendingOptimisticBuildsForStructure,
  isOptimisticBuildPendingAtHex,
  markOptimisticBuildOperationFailed,
  reconcileOptimisticBuildOperations,
  registerOptimisticBuildOperation,
} from "./optimistic-build-registry";

describe("optimistic-build-registry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetOptimisticBuildRegistryForTests();
  });

  afterEach(() => {
    __resetOptimisticBuildRegistryForTests();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps optimistic occupancy until authoritative confirmation", () => {
    const removeOverride = vi.fn();

    registerOptimisticBuildOperation({
      operationId: "op-1",
      structureEntityId: 11,
      outerCol: 7,
      outerRow: 9,
      innerCol: 3,
      innerRow: 4,
      buildingType: BuildingType.ResourceWheat,
      expectedBuildingCount: 1,
      startedAtMs: 1_000,
      staleAfterMs: 60_000,
      removeOverride,
    });

    expect(
      isOptimisticBuildPendingAtHex({
        outerCol: 7,
        outerRow: 9,
        innerCol: 3,
        innerRow: 4,
      }),
    ).toBe(true);
    expect(hasPendingOptimisticBuildsForStructure(11)).toBe(true);

    reconcileOptimisticBuildOperations({
      structureEntityId: 11,
      activeProductions: [{ buildingType: BuildingType.ResourceFish, buildingCount: 1 }],
    });

    expect(removeOverride).not.toHaveBeenCalled();
    expect(hasPendingOptimisticBuildsForStructure(11)).toBe(true);

    reconcileOptimisticBuildOperations({
      structureEntityId: 11,
      activeProductions: [{ buildingType: BuildingType.ResourceWheat, buildingCount: 1 }],
    });

    expect(removeOverride).toHaveBeenCalledTimes(1);
    expect(hasPendingOptimisticBuildsForStructure(11)).toBe(false);
    expect(
      isOptimisticBuildPendingAtHex({
        outerCol: 7,
        outerRow: 9,
        innerCol: 3,
        innerRow: 4,
      }),
    ).toBe(false);
  });

  it("reconciles matching operations in deterministic order", () => {
    const removeFirst = vi.fn();
    const removeSecond = vi.fn();

    registerOptimisticBuildOperation({
      operationId: "op-1",
      structureEntityId: 22,
      outerCol: 1,
      outerRow: 1,
      innerCol: 2,
      innerRow: 2,
      buildingType: BuildingType.ResourceWheat,
      expectedBuildingCount: 1,
      startedAtMs: 1_000,
      staleAfterMs: 60_000,
      removeOverride: removeFirst,
    });

    registerOptimisticBuildOperation({
      operationId: "op-2",
      structureEntityId: 22,
      outerCol: 1,
      outerRow: 1,
      innerCol: 3,
      innerRow: 2,
      buildingType: BuildingType.ResourceWheat,
      expectedBuildingCount: 2,
      startedAtMs: 2_000,
      staleAfterMs: 60_000,
      removeOverride: removeSecond,
    });

    reconcileOptimisticBuildOperations({
      structureEntityId: 22,
      activeProductions: [{ buildingType: BuildingType.ResourceWheat, buildingCount: 1 }],
    });

    expect(removeFirst).toHaveBeenCalledTimes(1);
    expect(removeSecond).not.toHaveBeenCalled();

    reconcileOptimisticBuildOperations({
      structureEntityId: 22,
      activeProductions: [{ buildingType: BuildingType.ResourceWheat, buildingCount: 2 }],
    });

    expect(removeSecond).toHaveBeenCalledTimes(1);
    expect(hasPendingOptimisticBuildsForStructure(22)).toBe(false);
  });

  it("heals expected-count ordering when an earlier operation fails", () => {
    const removeFirst = vi.fn();
    const removeSecond = vi.fn();

    registerOptimisticBuildOperation({
      operationId: "op-1",
      structureEntityId: 33,
      outerCol: 10,
      outerRow: 10,
      innerCol: 4,
      innerRow: 4,
      buildingType: BuildingType.ResourceWheat,
      expectedBuildingCount: 1,
      startedAtMs: 1_000,
      staleAfterMs: 60_000,
      removeOverride: removeFirst,
    });

    registerOptimisticBuildOperation({
      operationId: "op-2",
      structureEntityId: 33,
      outerCol: 10,
      outerRow: 10,
      innerCol: 5,
      innerRow: 4,
      buildingType: BuildingType.ResourceWheat,
      expectedBuildingCount: 2,
      startedAtMs: 2_000,
      staleAfterMs: 60_000,
      removeOverride: removeSecond,
    });

    markOptimisticBuildOperationFailed("op-1");

    expect(removeFirst).toHaveBeenCalledTimes(1);
    expect(getPendingOptimisticBuildCountForStructureAndType(33, BuildingType.ResourceWheat)).toBe(1);

    reconcileOptimisticBuildOperations({
      structureEntityId: 33,
      activeProductions: [{ buildingType: BuildingType.ResourceWheat, buildingCount: 1 }],
    });

    expect(removeSecond).toHaveBeenCalledTimes(1);
    expect(hasPendingOptimisticBuildsForStructure(33)).toBe(false);
  });

  it("cleans stale operations once and remains idempotent", () => {
    const removeOverride = vi.fn();
    vi.spyOn(console, "warn").mockImplementation(() => {});

    registerOptimisticBuildOperation({
      operationId: "op-stale",
      structureEntityId: 44,
      outerCol: 6,
      outerRow: 6,
      innerCol: 1,
      innerRow: 2,
      buildingType: BuildingType.ResourceWheat,
      expectedBuildingCount: 1,
      startedAtMs: 1_000,
      staleAfterMs: 5_000,
      removeOverride,
    });

    vi.advanceTimersByTime(5_001);

    expect(removeOverride).toHaveBeenCalledTimes(1);
    expect(hasPendingOptimisticBuildsForStructure(44)).toBe(false);

    markOptimisticBuildOperationFailed("op-stale");
    expect(removeOverride).toHaveBeenCalledTimes(1);
  });
});
