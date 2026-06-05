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

/** A slot that is actually drawn (in a model's activeInstances AND within mesh.count). */
interface DrawnSlotOwner {
  slot: number;
  /** matrixIndexOwners.get(slot); undefined when the slot has no recorded owner. */
  owner: number | undefined;
}

export interface ArmyRenderIntegrityInput {
  /** Slots the GPU is currently drawing, with their recorded owner entity. */
  drawnSlotOwners: DrawnSlotOwner[];
  /** Numeric ids of every army the manager currently tracks (this.armies). */
  liveEntityIds: Set<number>;
  /**
   * Entities that *should* be rendered right now (in-chunk, committed, not
   * suppressed) but whose model is not drawn — the caller computes this because
   * it owns the chunk/visibility predicates.
   */
  visibleUndrawnEntityIds: Array<number | string>;
}

export type ArmyRenderViolation =
  | {
      // A drawn slot owned by no live army — the frozen "ghost" left after a
      // unit dies/moves when its slot wasn't fully torn down. The label, keyed
      // by entityId, is already gone; only the model lingers.
      kind: "orphaned-drawn-slot";
      slot: number;
      owner: number | undefined;
    }
  | {
      // A live army that should be visible but has no drawn model — the
      // "spawned but never appeared" case. Its label still tracks because the
      // label reads instanceData.position, not the slot.
      kind: "visible-not-drawn";
      entityId: number | string;
    };

/**
 * Detect the two user-visible ghosting symptoms directly, rather than only the
 * mirror/SSOT divergence in {@link auditArmySlots}: a model drawn for a dead
 * army (orphaned slot) and a live army with no model drawn (missing spawn).
 */
export function auditArmyRenderIntegrity(input: ArmyRenderIntegrityInput): ArmyRenderViolation[] {
  const violations: ArmyRenderViolation[] = [];

  for (const { slot, owner } of input.drawnSlotOwners) {
    if (owner === undefined || !input.liveEntityIds.has(owner)) {
      violations.push({ kind: "orphaned-drawn-slot", slot, owner });
    }
  }

  for (const entityId of input.visibleUndrawnEntityIds) {
    violations.push({ kind: "visible-not-drawn", entityId });
  }

  return violations;
}

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
