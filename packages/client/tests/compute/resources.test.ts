import { describe, it, expect } from "vitest";
import { computeBalance, computeDepletionTime } from "../../src/compute/resources.js";

const PRECISION = 1_000_000_000;

describe("computeBalance", () => {
  it("should add production to raw balance over elapsed ticks", () => {
    const result = computeBalance({
      rawBalance: 1 * PRECISION,
      productionRate: PRECISION / 2, // 0.5 per tick
      lastUpdatedAt: 0,
      currentTick: 10,
      isFood: false,
      outputAmountLeft: 100 * PRECISION,
      buildingCount: 1,
      storageCapacityKg: 1000,
      storageUsedKg: 0,
      resourceWeightKg: 1,
      precision: PRECISION,
    });

    // 1 + (10 * 0.5) = 6
    expect(result.balance).toBe(6);
    expect(result.amountProduced).toBe(5);
  });

  it("should return raw balance when production rate is zero", () => {
    const result = computeBalance({
      rawBalance: 5 * PRECISION,
      productionRate: 0,
      lastUpdatedAt: 0,
      currentTick: 100,
      isFood: false,
      outputAmountLeft: 0,
      buildingCount: 0,
      storageCapacityKg: 1000,
      storageUsedKg: 0,
      resourceWeightKg: 1,
      precision: PRECISION,
    });

    expect(result.balance).toBe(5);
    expect(result.amountProduced).toBe(0);
    expect(result.atMaxCapacity).toBe(false);
  });

  it("should cap non-food production at outputAmountLeft", () => {
    const result = computeBalance({
      rawBalance: 0,
      productionRate: 10 * PRECISION, // 10 per tick
      lastUpdatedAt: 0,
      currentTick: 100,
      isFood: false,
      outputAmountLeft: 50 * PRECISION, // only 50 units left to produce
      buildingCount: 1,
      storageCapacityKg: 100000,
      storageUsedKg: 0,
      resourceWeightKg: 1,
      precision: PRECISION,
    });

    // Would produce 1000, but capped at 50
    expect(result.balance).toBe(50);
    expect(result.amountProduced).toBe(50);
  });

  it("should not cap food production at outputAmountLeft", () => {
    const result = computeBalance({
      rawBalance: 0,
      productionRate: 10 * PRECISION,
      lastUpdatedAt: 0,
      currentTick: 100,
      isFood: true,
      outputAmountLeft: 50 * PRECISION,
      buildingCount: 1,
      storageCapacityKg: 100000,
      storageUsedKg: 0,
      resourceWeightKg: 1,
      precision: PRECISION,
    });

    // Food ignores outputAmountLeft
    expect(result.balance).toBe(1000);
    expect(result.amountProduced).toBe(1000);
  });

  it("should cap production at available storage capacity", () => {
    const result = computeBalance({
      rawBalance: 0,
      productionRate: 100 * PRECISION,
      lastUpdatedAt: 0,
      currentTick: 100,
      isFood: false,
      outputAmountLeft: 100000 * PRECISION,
      buildingCount: 1,
      storageCapacityKg: 50, // Only 50 kg free
      storageUsedKg: 0,
      resourceWeightKg: 1, // 1 kg per unit
      precision: PRECISION,
    });

    // Would produce 10000, but storage only holds 50 units at 1kg each
    expect(result.balance).toBe(50);
    expect(result.atMaxCapacity).toBe(true);
  });

  it("should account for already used storage", () => {
    const result = computeBalance({
      rawBalance: 10 * PRECISION,
      productionRate: 100 * PRECISION,
      lastUpdatedAt: 0,
      currentTick: 100,
      isFood: false,
      outputAmountLeft: 100000 * PRECISION,
      buildingCount: 1,
      storageCapacityKg: 50,
      storageUsedKg: 30, // 30kg already used
      resourceWeightKg: 1,
      precision: PRECISION,
    });

    // Free storage: 50 - 30 = 20kg = 20 units, plus the 10 existing
    // Total capacity for this resource = 20 units storeable + 10 existing = 20 max (capped)
    // Actually: rawBalance is 10, produced would be 10000, total = 10010
    // But storage only has 20 free slots, so max balance = 20
    expect(result.balance).toBe(20);
    expect(result.atMaxCapacity).toBe(true);
  });

  it("should return zero balance when no production and no raw balance", () => {
    const result = computeBalance({
      rawBalance: 0,
      productionRate: 0,
      lastUpdatedAt: 0,
      currentTick: 10,
      isFood: false,
      outputAmountLeft: 0,
      buildingCount: 0,
      storageCapacityKg: 100,
      storageUsedKg: 0,
      resourceWeightKg: 1,
      precision: PRECISION,
    });

    expect(result.balance).toBe(0);
    expect(result.amountProduced).toBe(0);
  });

  it("should handle no ticks elapsed", () => {
    const result = computeBalance({
      rawBalance: 5 * PRECISION,
      productionRate: 10 * PRECISION,
      lastUpdatedAt: 50,
      currentTick: 50,
      isFood: false,
      outputAmountLeft: 1000 * PRECISION,
      buildingCount: 1,
      storageCapacityKg: 1000,
      storageUsedKg: 0,
      resourceWeightKg: 1,
      precision: PRECISION,
    });

    expect(result.balance).toBe(5);
    expect(result.amountProduced).toBe(0);
  });
});

describe("computeDepletionTime", () => {
  it("should calculate depletion time for non-food resources", () => {
    const result = computeDepletionTime({
      outputAmountLeft: 100 * PRECISION,
      productionRate: 10 * PRECISION,
      lastUpdatedAt: 0,
      currentTick: 0,
      tickIntervalSeconds: 1,
      isFood: false,
      precision: PRECISION,
    });

    // 100 / 10 = 10 ticks, at 1 second per tick = 10 seconds
    expect(result.timeRemainingSeconds).toBe(10);
    expect(result.depletesAt).not.toBeNull();
  });

  it("should return infinite depletion time for food resources", () => {
    const result = computeDepletionTime({
      outputAmountLeft: 100 * PRECISION,
      productionRate: 10 * PRECISION,
      lastUpdatedAt: 0,
      currentTick: 0,
      tickIntervalSeconds: 1,
      isFood: true,
      precision: PRECISION,
    });

    expect(result.timeRemainingSeconds).toBe(Infinity);
    expect(result.depletesAt).toBeNull();
  });

  it("should account for already elapsed ticks", () => {
    const result = computeDepletionTime({
      outputAmountLeft: 100 * PRECISION,
      productionRate: 10 * PRECISION,
      lastUpdatedAt: 0,
      currentTick: 5, // 5 ticks already passed, 50 units produced
      tickIntervalSeconds: 2,
      isFood: false,
      precision: PRECISION,
    });

    // remaining = 100 - 50 = 50 units, at 10/tick = 5 ticks, at 2 sec/tick = 10 seconds
    expect(result.timeRemainingSeconds).toBe(10);
  });

  it("should return zero when already depleted", () => {
    const result = computeDepletionTime({
      outputAmountLeft: 50 * PRECISION,
      productionRate: 10 * PRECISION,
      lastUpdatedAt: 0,
      currentTick: 10, // 10 ticks * 10/tick = 100 produced, but only 50 left
      tickIntervalSeconds: 1,
      isFood: false,
      precision: PRECISION,
    });

    expect(result.timeRemainingSeconds).toBe(0);
    expect(result.depletesAt).not.toBeNull();
  });

  it("should return infinite when production rate is zero", () => {
    const result = computeDepletionTime({
      outputAmountLeft: 100 * PRECISION,
      productionRate: 0,
      lastUpdatedAt: 0,
      currentTick: 0,
      tickIntervalSeconds: 1,
      isFood: false,
      precision: PRECISION,
    });

    expect(result.timeRemainingSeconds).toBe(Infinity);
    expect(result.depletesAt).toBeNull();
  });
});
