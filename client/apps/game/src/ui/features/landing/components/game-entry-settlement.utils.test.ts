// @vitest-environment node

import { describe, expect, it } from "vitest";
import { StructureType } from "@bibliothecadao/types";

import {
  applyDashboardRegistrationHint,
  buildSettlementExecutionPlan,
  deriveSettlementPhaseViewModel,
  deriveSettlementStatus,
  findIndexedRealmSettlement,
  findNewIndexedVillageSettlement,
  getExpectedSettlementCount,
  hasReachedSettlementTarget,
  parseSnapshotRegistrationRow,
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

describe("findIndexedRealmSettlement", () => {
  it("matches the newly indexed realm by realm id", () => {
    const realm = { category: StructureType.Realm, entity_id: 101, realm_id: 77, coord_x: 12, coord_y: 13 };

    expect(
      findIndexedRealmSettlement(
        [{ category: StructureType.Village, entity_id: 202, realm_id: null, coord_x: 12, coord_y: 13 }, realm],
        { realmId: 77, coordX: null, coordY: null },
      ),
    ).toBe(realm);
  });

  it("falls back to selected settlement coordinates when the realm id is not indexed yet", () => {
    const realm = { category: StructureType.Realm, entity_id: 101, realm_id: null, coord_x: 22, coord_y: 23 };

    expect(
      findIndexedRealmSettlement([realm], {
        realmId: 77,
        coordX: 22,
        coordY: 23,
      }),
    ).toBe(realm);
  });
});

describe("findNewIndexedVillageSettlement", () => {
  it("returns the newest village that was not present before submission", () => {
    const oldestVillage = { category: StructureType.Village, entity_id: 10, realm_id: null, coord_x: 1, coord_y: 1 };
    const newVillage = { category: StructureType.Village, entity_id: 12, realm_id: null, coord_x: 3, coord_y: 3 };

    expect(
      findNewIndexedVillageSettlement(
        [
          oldestVillage,
          { category: StructureType.Realm, entity_id: 11, realm_id: 5, coord_x: 2, coord_y: 2 },
          newVillage,
        ],
        new Set([10]),
      ),
    ).toBe(newVillage);
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

  it("shows a syncing state without an error banner after settlement submission", () => {
    const viewModel = deriveSettlementPhaseViewModel({
      stage: "syncing",
      assignedCount: 0,
      settledCount: 0,
    });

    expect(viewModel.isComplete).toBe(false);
    expect(viewModel.showError).toBe(false);
    expect(viewModel.stepStatuses[1]).toBe("complete");
    expect(viewModel.stepStatuses[2]).toBe("complete");
    expect(viewModel.stepStatuses[3]).toBe("active");
  });
});

describe("applyDashboardRegistrationHint", () => {
  it("treats dashboard play handoffs as registered while the settlement index catches up", () => {
    const hintedSnapshot = applyDashboardRegistrationHint({
      snapshot: snapshot(),
      entryIntent: "play",
      hasDashboardRegistrationEntry: true,
    });

    expect(hintedSnapshot.registered).toBe(true);
    expect(deriveSettlementStatus(hintedSnapshot).needsSettlement).toBe(true);
  });

  it("also treats dashboard settle handoffs as registered while the settlement index catches up", () => {
    const hintedSnapshot = applyDashboardRegistrationHint({
      snapshot: snapshot(),
      entryIntent: "settle",
      hasDashboardRegistrationEntry: true,
    });

    expect(hintedSnapshot.registered).toBe(true);
    expect(deriveSettlementStatus(hintedSnapshot).needsSettlement).toBe(true);
  });

  it("does not invent registration outside dashboard play or settle flows", () => {
    expect(
      applyDashboardRegistrationHint({
        snapshot: snapshot(),
        entryIntent: "spectate",
        hasDashboardRegistrationEntry: true,
      }).registered,
    ).toBe(false);

    expect(
      applyDashboardRegistrationHint({
        snapshot: snapshot(),
        entryIntent: "forge",
        hasDashboardRegistrationEntry: true,
      }).registered,
    ).toBe(false);

    expect(
      applyDashboardRegistrationHint({
        snapshot: snapshot(),
        entryIntent: "settle",
        hasDashboardRegistrationEntry: false,
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
      applyDashboardRegistrationHint({
        snapshot: progressedSnapshot,
        entryIntent: "play",
        hasDashboardRegistrationEntry: true,
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

  it("continues partial mainnet settlement when coords indexing is unavailable", () => {
    const plan = buildSettlementExecutionPlan({
      isMainnet: true,
      singleRealmMode: false,
      snapshot: snapshot({
        registered: false,
        onceRegistered: true,
        coordsCount: 0,
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

  it("does not preempt the settle call for onceRegistered players who have no coords yet", () => {
    const plan = buildSettlementExecutionPlan({
      isMainnet: false,
      singleRealmMode: true,
      snapshot: snapshot({ registered: false, onceRegistered: true }),
    });

    expect(plan.shouldAssignAndSettle).toBe(true);
    expect(plan.missingAssignmentRegistration).toBe(false);
  });

  it("still blocks truly unregistered players from the assign+settle path", () => {
    const plan = buildSettlementExecutionPlan({
      isMainnet: false,
      singleRealmMode: true,
      snapshot: snapshot({ registered: false, onceRegistered: false }),
    });

    expect(plan.shouldAssignAndSettle).toBe(true);
    expect(plan.missingAssignmentRegistration).toBe(true);
  });
});

describe("parseSnapshotRegistrationRow", () => {
  it("returns false for null / undefined rows", () => {
    expect(parseSnapshotRegistrationRow(null)).toEqual({ registered: false, onceRegistered: false });
    expect(parseSnapshotRegistrationRow(undefined)).toEqual({ registered: false, onceRegistered: false });
    expect(parseSnapshotRegistrationRow({})).toEqual({ registered: false, onceRegistered: false });
  });

  it("accepts native booleans", () => {
    expect(parseSnapshotRegistrationRow({ registered: true, once_registered: false })).toEqual({
      registered: true,
      onceRegistered: false,
    });
  });

  it("accepts numeric 1/0 from Torii SQL", () => {
    expect(parseSnapshotRegistrationRow({ registered: 1, once_registered: 0 })).toEqual({
      registered: true,
      onceRegistered: false,
    });
    expect(parseSnapshotRegistrationRow({ registered: 0, once_registered: 1 })).toEqual({
      registered: false,
      onceRegistered: true,
    });
  });

  it('accepts string "1"/"0" from Torii SQL', () => {
    expect(parseSnapshotRegistrationRow({ registered: "0", once_registered: "1" })).toEqual({
      registered: false,
      onceRegistered: true,
    });
  });
});
