/**
 * Dev-only tripwire for army InstancedMesh slot integrity.
 *
 * A visible unit's slot is tracked in two layers: the army-manager's compact
 * visibleArmyIndices and the army-model's single
 * source of truth (instanceData.matrixIndex). The reported ghost — a frozen
 * duplicate at a unit's OLD position after it moves — is what happens when those
 * diverge and a movement is seeded from the stale mirror. This auditor reports
 * that divergence (and two entities sharing one live slot, which is how a drawn
 * ghost actually manifests) so regressions are caught at their source.
 */

export interface ArmySlotAuditEntry {
  entityId: number | string;
  /** What the army-manager's compact visible set believes. */
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

/** A drawn slot's GPU position paired with the entity's authoritative position. */
export interface DrawnSlotPositionEntry {
  entityId: number;
  slot: number;
  drawn: { x: number; z: number };
  expected: { x: number; z: number };
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
  /**
   * Drawn matrix positions vs authoritative positions for stationary drawn
   * armies. The caller excludes moving armies — mid-spline drift is expected.
   */
  drawnPositionEntries?: DrawnSlotPositionEntry[];
  /** Hex-plane drift beyond this is a stale matrix, not float noise. */
  positionDriftEpsilon?: number;
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
    }
  | {
      // A live, stationary army whose drawn matrix sits away from its
      // authoritative position — the model stands on the OLD hex while the
      // label (reading instanceData.position) stands on the new one. This is
      // the both-directions desync a stale slot matrix manufactures.
      kind: "stale-drawn-position";
      entityId: number;
      slot: number;
      driftDistance: number;
    }
  | {
      // One entity recorded as the owner of two or more drawn slots — the
      // extra slot draws a second, frozen copy of the unit.
      kind: "duplicate-drawn-owner";
      owner: number;
      slots: number[];
    };

const DEFAULT_POSITION_DRIFT_EPSILON = 0.75;

/**
 * Detect the two user-visible ghosting symptoms directly, rather than only the
 * mirror/SSOT divergence in {@link auditArmySlots}: a model drawn for a dead
 * army (orphaned slot) and a live army with no model drawn (missing spawn).
 */
export function auditArmyRenderIntegrity(input: ArmyRenderIntegrityInput): ArmyRenderViolation[] {
  const violations: ArmyRenderViolation[] = [];

  const slotsByOwner = new Map<number, number[]>();
  for (const { slot, owner } of input.drawnSlotOwners) {
    if (owner === undefined || !input.liveEntityIds.has(owner)) {
      violations.push({ kind: "orphaned-drawn-slot", slot, owner });
      continue;
    }
    const slots = slotsByOwner.get(owner);
    if (slots) {
      slots.push(slot);
    } else {
      slotsByOwner.set(owner, [slot]);
    }
  }

  for (const [owner, slots] of slotsByOwner) {
    if (slots.length > 1) {
      violations.push({ kind: "duplicate-drawn-owner", owner, slots });
    }
  }

  for (const entityId of input.visibleUndrawnEntityIds) {
    violations.push({ kind: "visible-not-drawn", entityId });
  }

  const epsilon = input.positionDriftEpsilon ?? DEFAULT_POSITION_DRIFT_EPSILON;
  for (const { entityId, slot, drawn, expected } of input.drawnPositionEntries ?? []) {
    const driftDistance = Math.hypot(drawn.x - expected.x, drawn.z - expected.z);
    if (driftDistance > epsilon) {
      violations.push({ kind: "stale-drawn-position", entityId, slot, driftDistance });
    }
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
