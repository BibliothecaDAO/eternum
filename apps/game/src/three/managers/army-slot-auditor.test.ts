import { describe, expect, it } from "vitest";

import { auditArmyRenderIntegrity, auditArmySlots } from "./army-slot-auditor";

// The ghost bug is, at its core, the army-manager's compact visible-slot map
// drifting from the army-model's
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

// auditArmyRenderIntegrity catches the two user-visible symptoms that the
// mirror/SSOT auditor above cannot: a model still drawn for a dead army, and a
// live army whose model never appeared.
describe("auditArmyRenderIntegrity", () => {
  it("reports nothing when every drawn slot is owned by a live army and nothing is missing", () => {
    expect(
      auditArmyRenderIntegrity({
        drawnSlotOwners: [
          { slot: 0, owner: 1 },
          { slot: 1, owner: 2 },
        ],
        liveEntityIds: new Set([1, 2]),
        visibleUndrawnEntityIds: [],
      }),
    ).toEqual([]);
  });

  it("flags a drawn slot whose owner is no longer a live army (death ghost)", () => {
    const violations = auditArmyRenderIntegrity({
      drawnSlotOwners: [
        { slot: 0, owner: 1 },
        { slot: 4, owner: 99 }, // 99 already removed from this.armies
      ],
      liveEntityIds: new Set([1]),
      visibleUndrawnEntityIds: [],
    });

    expect(violations).toContainEqual({ kind: "orphaned-drawn-slot", slot: 4, owner: 99 });
    expect(violations).not.toContainEqual({ kind: "orphaned-drawn-slot", slot: 0, owner: 1 });
  });

  it("flags a drawn slot with no recorded owner at all", () => {
    const violations = auditArmyRenderIntegrity({
      drawnSlotOwners: [{ slot: 3, owner: undefined }],
      liveEntityIds: new Set([1, 2]),
      visibleUndrawnEntityIds: [],
    });

    expect(violations).toContainEqual({ kind: "orphaned-drawn-slot", slot: 3, owner: undefined });
  });

  it("flags a live army that should be visible but has no drawn model (missing spawn)", () => {
    const violations = auditArmyRenderIntegrity({
      drawnSlotOwners: [{ slot: 0, owner: 1 }],
      liveEntityIds: new Set([1, 7]),
      visibleUndrawnEntityIds: [7],
    });

    expect(violations).toContainEqual({ kind: "visible-not-drawn", entityId: 7 });
  });

  it("flags a stationary army whose drawn matrix drifted from its authoritative position", () => {
    const violations = auditArmyRenderIntegrity({
      drawnSlotOwners: [{ slot: 0, owner: 1 }],
      liveEntityIds: new Set([1]),
      visibleUndrawnEntityIds: [],
      drawnPositionEntries: [{ entityId: 1, slot: 0, drawn: { x: 0, z: 0 }, expected: { x: 3, z: 4 } }],
    });

    expect(violations).toContainEqual({ kind: "stale-drawn-position", entityId: 1, slot: 0, driftDistance: 5 });
  });

  it("tolerates sub-epsilon drift on drawn positions (float noise, not a ghost)", () => {
    const violations = auditArmyRenderIntegrity({
      drawnSlotOwners: [{ slot: 0, owner: 1 }],
      liveEntityIds: new Set([1]),
      visibleUndrawnEntityIds: [],
      drawnPositionEntries: [{ entityId: 1, slot: 0, drawn: { x: 0.1, z: 0 }, expected: { x: 0, z: 0 } }],
    });

    expect(violations).toEqual([]);
  });

  it("flags one entity owning two drawn slots (a frozen duplicate)", () => {
    const violations = auditArmyRenderIntegrity({
      drawnSlotOwners: [
        { slot: 0, owner: 1 },
        { slot: 5, owner: 1 },
      ],
      liveEntityIds: new Set([1]),
      visibleUndrawnEntityIds: [],
    });

    expect(violations).toContainEqual({ kind: "duplicate-drawn-owner", owner: 1, slots: [0, 5] });
  });
});
