import { describe, expect, it } from "vitest";

import {
  buildSettlementExecutionPlan,
  deriveSettlementStatus,
  getExpectedSettlementCount,
  type SettlementSnapshot,
} from "./game-entry-settlement.utils";

const snapshot = (partial: Partial<SettlementSnapshot> = {}): SettlementSnapshot => ({
  registered: false,
  onceRegistered: false,
  hasSettledStructure: false,
  coordsCount: 0,
  settledCount: 0,
  ...partial,
});

describe("deriveSettlementStatus", () => {
  it("does not require settlement for unregistered players", () => {
    const result = deriveSettlementStatus(snapshot());
    expect(result.needsSettlement).toBe(false);
    expect(result.canPlay).toBe(false);
  });

  it("requires settlement for registered players who have not settled yet", () => {
    const result = deriveSettlementStatus(snapshot({ registered: true }));
    expect(result.needsSettlement).toBe(true);
    expect(result.assignedCount).toBe(0);
  });

  it("keeps settlement required for partial states even when registered is false", () => {
    const result = deriveSettlementStatus(
      snapshot({
        registered: false,
        onceRegistered: true,
        hasSettledStructure: true,
        coordsCount: 2,
        settledCount: 1,
      }),
    );

    expect(result.assignedCount).toBe(3);
    expect(result.remainingToSettle).toBe(2);
    expect(result.canPlay).toBe(false);
    expect(result.needsSettlement).toBe(true);
  });

  it("marks complete states as playable", () => {
    const result = deriveSettlementStatus(
      snapshot({
        registered: false,
        onceRegistered: true,
        hasSettledStructure: true,
        coordsCount: 0,
        settledCount: 3,
      }),
    );

    expect(result.assignedCount).toBe(3);
    expect(result.remainingToSettle).toBe(0);
    expect(result.canPlay).toBe(true);
    expect(result.needsSettlement).toBe(false);
  });
});

describe("buildSettlementExecutionPlan", () => {
  it("plans 1 + 2 calls for fresh mainnet multi-realm settlement", () => {
    const plan = buildSettlementExecutionPlan({
      isMainnet: true,
      singleRealmMode: false,
      snapshot: snapshot({ registered: true }),
    });

    expect(plan.targetSettleCount).toBe(3);
    expect(plan.shouldAssignAndSettle).toBe(true);
    expect(plan.initialSettleCount).toBe(1);
    expect(plan.extraSettleCalls).toBe(2);
    expect(plan.missingAssignmentRegistration).toBe(false);
  });

  it("continues settling from partial mainnet progress without re-assigning", () => {
    const plan = buildSettlementExecutionPlan({
      isMainnet: true,
      singleRealmMode: false,
      snapshot: snapshot({
        registered: false,
        onceRegistered: true,
        coordsCount: 2,
        settledCount: 1,
      }),
    });

    expect(plan.targetSettleCount).toBe(3);
    expect(plan.shouldAssignAndSettle).toBe(false);
    expect(plan.initialSettleCount).toBe(0);
    expect(plan.extraSettleCalls).toBe(2);
    expect(plan.missingAssignmentRegistration).toBe(false);
  });

  it("plans single-call non-mainnet multi-realm settlement", () => {
    const plan = buildSettlementExecutionPlan({
      isMainnet: false,
      singleRealmMode: false,
      snapshot: snapshot({ registered: true }),
    });

    expect(plan.targetSettleCount).toBe(3);
    expect(plan.shouldAssignAndSettle).toBe(true);
    expect(plan.initialSettleCount).toBe(3);
    expect(plan.extraSettleCalls).toBe(0);
  });

  it("uses target count of one in single realm mode", () => {
    const plan = buildSettlementExecutionPlan({
      isMainnet: true,
      singleRealmMode: true,
      snapshot: snapshot({ registered: true }),
    });

    expect(getExpectedSettlementCount(true)).toBe(1);
    expect(plan.targetSettleCount).toBe(1);
    expect(plan.initialSettleCount).toBe(1);
    expect(plan.extraSettleCalls).toBe(0);
  });
});
