import { describe, expect, it } from "vitest";

import {
  applyAutoSettleRegistrationHint,
  buildSettlementExecutionPlan,
  deriveSettlementPhaseViewModel,
  deriveSettlementStatus,
  getExpectedSettlementCount,
  hasReachedSettlementTarget,
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

  it("treats indexed settlement completion as playable even when owned structures lag", () => {
    const result = deriveSettlementStatus(
      snapshot({
        registered: false,
        onceRegistered: true,
        hasSettledStructure: false,
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

describe("hasReachedSettlementTarget", () => {
  it("treats structure_ids progress as authoritative for completed targets", () => {
    expect(hasReachedSettlementTarget({ settledCount: 3 }, 3)).toBe(true);
    expect(hasReachedSettlementTarget({ settledCount: 1 }, 1)).toBe(true);
  });

  it("keeps incomplete settlement targets pending", () => {
    expect(hasReachedSettlementTarget({ settledCount: 2 }, 3)).toBe(false);
    expect(hasReachedSettlementTarget({ settledCount: 0 }, 1)).toBe(false);
  });
});

describe("deriveSettlementPhaseViewModel", () => {
  it("suppresses the error banner once settlement is complete", () => {
    const viewModel = deriveSettlementPhaseViewModel({
      stage: "error",
      assignedCount: 3,
      settledCount: 3,
    });

    expect(viewModel.isComplete).toBe(true);
    expect(viewModel.showError).toBe(false);
  });

  it("marks all three steps complete when settlement has finished", () => {
    const viewModel = deriveSettlementPhaseViewModel({
      stage: "done",
      assignedCount: 3,
      settledCount: 3,
    });

    expect(viewModel.stepStatuses[1]).toBe("complete");
    expect(viewModel.stepStatuses[2]).toBe("complete");
    expect(viewModel.stepStatuses[3]).toBe("complete");
  });

  it("keeps incomplete failed settlement in the error state", () => {
    const viewModel = deriveSettlementPhaseViewModel({
      stage: "error",
      assignedCount: 3,
      settledCount: 1,
    });

    expect(viewModel.isComplete).toBe(false);
    expect(viewModel.showError).toBe(true);
    expect(viewModel.stepStatuses[3]).toBe("pending");
  });
});

describe("applyAutoSettleRegistrationHint", () => {
  it("treats auto-settle entry handoffs as registered while the settlement index catches up", () => {
    const hintedSnapshot = applyAutoSettleRegistrationHint({
      snapshot: snapshot(),
      autoSettleEnabled: true,
      entryIntent: "settle",
      hasAutoSettleEntry: true,
    });

    expect(hintedSnapshot.registered).toBe(true);
    expect(deriveSettlementStatus(hintedSnapshot).needsSettlement).toBe(true);
  });

  it("does not invent registration outside the auto-settle settle flow", () => {
    expect(
      applyAutoSettleRegistrationHint({
        snapshot: snapshot(),
        autoSettleEnabled: false,
        entryIntent: "settle",
        hasAutoSettleEntry: true,
      }).registered,
    ).toBe(false);

    expect(
      applyAutoSettleRegistrationHint({
        snapshot: snapshot(),
        autoSettleEnabled: true,
        entryIntent: "play",
        hasAutoSettleEntry: true,
      }).registered,
    ).toBe(false);
  });

  it("keeps indexed settlement progress unchanged", () => {
    const progressedSnapshot = snapshot({
      registered: false,
      onceRegistered: true,
      coordsCount: 2,
      settledCount: 1,
    });

    expect(
      applyAutoSettleRegistrationHint({
        snapshot: progressedSnapshot,
        autoSettleEnabled: true,
        entryIntent: "settle",
        hasAutoSettleEntry: true,
      }),
    ).toEqual(progressedSnapshot);
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
