/**
 * Dev-only tripwire for army InstancedMesh slot integrity.
 *
 * A unit's slot is tracked in two layers: the army-manager's mirror
 * (visibleArmyIndices / ArmyData.matrixIndex) and the army-model's single
 * source of truth (instanceData.matrixIndex). The reported ghost — a frozen
 * duplicate at a unit's OLD position after it moves — is what happens when those
 * diverge and a movement is seeded from the stale mirror. This auditor reports
 * that divergence (and two entities sharing one live slot, which is how a drawn
 * ghost actually manifests) so regressions are caught at their source.
 */

export interface ArmySlotAuditEntry {
  entityId: number | string;
  /** What the army-manager believes (visibleArmyIndices / ArmyData.matrixIndex). */
  mirrorSlot: number | undefined;
  /** The army-model source of truth (instanceData.matrixIndex). */
  ssotSlot: number | undefined;
}

export type ArmySlotViolation =
  | {
      kind: "mirror-mismatch";
      entityId: number | string;
      mirrorSlot: number | undefined;
      ssotSlot: number | undefined;
    }
  | {
      kind: "shared-slot";
      slot: number;
      entityIds: Array<number | string>;
    };

export function auditArmySlots(entries: ArmySlotAuditEntry[]): ArmySlotViolation[] {
  const violations: ArmySlotViolation[] = [];

  // I2 — the manager's mirror must equal the model's source-of-truth slot.
  for (const entry of entries) {
    if (entry.mirrorSlot !== entry.ssotSlot) {
      violations.push({
        kind: "mirror-mismatch",
        entityId: entry.entityId,
        mirrorSlot: entry.mirrorSlot,
        ssotSlot: entry.ssotSlot,
      });
    }
  }

  // I3 — no two entities may occupy the same live slot (a drawn ghost).
  const entityIdsBySlot = new Map<number, Array<number | string>>();
  for (const entry of entries) {
    if (entry.ssotSlot === undefined) {
      continue;
    }
    const ids = entityIdsBySlot.get(entry.ssotSlot);
    if (ids) {
      ids.push(entry.entityId);
    } else {
      entityIdsBySlot.set(entry.ssotSlot, [entry.entityId]);
    }
  }
  for (const [slot, entityIds] of entityIdsBySlot) {
    if (entityIds.length > 1) {
      violations.push({ kind: "shared-slot", slot, entityIds });
    }
  }

  return violations;
}
