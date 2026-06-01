import { describe, expect, it } from "vitest";

import { auditArmySlots } from "./army-slot-auditor";

// The ghost bug is, at its core, the army-manager's mirror of an entity's slot
// (visibleArmyIndices / ArmyData.matrixIndex) drifting from the army-model's
// single source of truth (instanceData.matrixIndex). This auditor is the
// dev-only tripwire for exactly that divergence (and for two entities sharing a
// live slot, which is how a drawn ghost manifests).
describe("auditArmySlots", () => {
  it("reports no violations when every mirror matches its SSOT and slots are unique", () => {
    expect(
      auditArmySlots([
        { entityId: 1, mirrorSlot: 0, ssotSlot: 0 },
        { entityId: 2, mirrorSlot: 1, ssotSlot: 1 },
        { entityId: 3, mirrorSlot: 2, ssotSlot: 2 },
      ]),
    ).toEqual([]);
  });

  it("flags a mirror that disagrees with the model's source-of-truth slot", () => {
    const violations = auditArmySlots([
      { entityId: 1, mirrorSlot: 0, ssotSlot: 0 },
      { entityId: 42, mirrorSlot: 3, ssotSlot: 0 }, // mirror stale: model really at 0
    ]);

    expect(violations).toContainEqual({
      kind: "mirror-mismatch",
      entityId: 42,
      mirrorSlot: 3,
      ssotSlot: 0,
    });
  });

  it("flags a mirror present while the model has no live slot", () => {
    const violations = auditArmySlots([{ entityId: 7, mirrorSlot: 5, ssotSlot: undefined }]);

    expect(violations).toContainEqual({
      kind: "mirror-mismatch",
      entityId: 7,
      mirrorSlot: 5,
      ssotSlot: undefined,
    });
  });

  it("flags two entities sharing the same live slot (a drawn ghost)", () => {
    const violations = auditArmySlots([
      { entityId: 10, mirrorSlot: 2, ssotSlot: 2 },
      { entityId: 11, mirrorSlot: 2, ssotSlot: 2 },
    ]);

    expect(violations).toContainEqual({
      kind: "shared-slot",
      slot: 2,
      entityIds: [10, 11],
    });
  });

  it("does not treat multiple unrendered entities (undefined slot) as a shared slot", () => {
    expect(
      auditArmySlots([
        { entityId: 20, mirrorSlot: undefined, ssotSlot: undefined },
        { entityId: 21, mirrorSlot: undefined, ssotSlot: undefined },
      ]),
    ).toEqual([]);
  });
});
