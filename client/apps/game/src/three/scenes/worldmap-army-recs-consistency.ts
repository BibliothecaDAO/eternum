import type { ID } from "@bibliothecadao/types";

/**
 * Loop B of the ghost-army fix: the level-triggered "scene == RECS" invariant
 * enforcer.
 *
 * Event-driven updates (Torii subscriptions, optimistic actions) handle
 * latency, but a dropped or out-of-order event can leave the rendered worldmap
 * out of sync with local RECS state indefinitely. This module periodically
 * compares each rendered army against its RECS snapshot and emits corrective
 * actions so the scene converges back to RECS truth, no matter which event was
 * missed.
 *
 * This is a PURE policy module: no three.js, no scene access, no side effects.
 * Callers gather candidates, invoke {@link evaluateArmyRecsConsistency}, and
 * apply the returned actions (including maintaining the `missingSince`
 * two-strike map from `mark_missing` / `clear_missing` actions).
 */

export const ARMY_RECS_SWEEP_INTERVAL_MS = 5_000;
export const ARMY_RECS_MISSING_CONFIRM_MS = 8_000; // two-strike window for component absence
export const ARMY_RECS_STUCK_REMOVAL_MAX_AGE_MS = 30_000;

export interface ArmyRecsSnapshot {
  troopCount: number | null; // null = component absent from local RECS
  normalizedCoord: { col: number; row: number } | null;
}

export interface ArmyRecsConsistencyCandidate {
  entityId: ID;
  renderedPosition: { col: number; row: number } | undefined; // normalized coords
  recs: ArmyRecsSnapshot;
  isVisibleInCurrentChunk: boolean;
  hasPendingMovement: boolean;
  isMoving: boolean;
  hasOptimisticState: boolean;
  pendingRemovalScheduledAtMs: number | null; // null = no pending/deferred removal
}

export type ArmyRecsConsistencyAction =
  | { kind: "remove_dead"; entityId: ID; cause: "zero_troops" | "missing_component" }
  | { kind: "snap_position"; entityId: ID; to: { col: number; row: number } }
  | { kind: "restore_alive"; entityId: ID }
  | { kind: "mark_missing"; entityId: ID }
  | { kind: "clear_missing"; entityId: ID };

export function evaluateArmyRecsConsistency(input: {
  candidates: readonly ArmyRecsConsistencyCandidate[];
  missingSince: ReadonlyMap<ID, number>;
  nowMs: number;
}): ArmyRecsConsistencyAction[] {
  const { candidates, missingSince, nowMs } = input;
  const actions: ArmyRecsConsistencyAction[] = [];

  for (const candidate of candidates) {
    const { entityId, recs } = candidate;

    // Synthetic pending-create ghost ids are negative; never sweep them.
    if (entityId <= 0) {
      continue;
    }

    // In-flight movement or optimistic state owns the entity; defer judgement.
    if (candidate.hasPendingMovement || candidate.isMoving || candidate.hasOptimisticState) {
      continue;
    }

    if (recs.troopCount !== null) {
      // Component reappeared in local RECS; drop the two-strike tracker.
      if (missingSince.has(entityId)) {
        actions.push({ kind: "clear_missing", entityId });
      }

      if (recs.troopCount === 0) {
        // A fresh pending removal already covers this army; leave it to its
        // timeout. But scheduling delays max out around ~10s, so a removal
        // still pending past the stuck threshold means its timer was lost
        // (cleared without meta cleanup, stranded deferral) — without this
        // branch the dead army would render forever.
        const pendingRemovalIsStuck =
          candidate.pendingRemovalScheduledAtMs !== null &&
          nowMs - candidate.pendingRemovalScheduledAtMs >= ARMY_RECS_STUCK_REMOVAL_MAX_AGE_MS;
        if (candidate.pendingRemovalScheduledAtMs === null || pendingRemovalIsStuck) {
          actions.push({ kind: "remove_dead", entityId, cause: "zero_troops" });
        }
        continue;
      }

      // Alive in RECS.
      if (
        candidate.pendingRemovalScheduledAtMs !== null &&
        nowMs - candidate.pendingRemovalScheduledAtMs >= ARMY_RECS_STUCK_REMOVAL_MAX_AGE_MS
      ) {
        // A stale pending removal is hiding a live army.
        actions.push({ kind: "restore_alive", entityId });
        continue;
      }

      if (
        recs.normalizedCoord !== null &&
        candidate.renderedPosition !== undefined &&
        (recs.normalizedCoord.col !== candidate.renderedPosition.col ||
          recs.normalizedCoord.row !== candidate.renderedPosition.row)
      ) {
        actions.push({
          kind: "snap_position",
          entityId,
          to: { col: recs.normalizedCoord.col, row: recs.normalizedCoord.row },
        });
      }
      continue;
    }

    // Component absent from local RECS. Absence outside the subscribed/rendered
    // area is not evidence of death — only treat it as meaningful when the army
    // is visible in the current chunk.
    if (!candidate.isVisibleInCurrentChunk) {
      if (missingSince.has(entityId)) {
        actions.push({ kind: "clear_missing", entityId });
      }
      continue;
    }

    const missingSinceMs = missingSince.get(entityId);
    if (missingSinceMs === undefined) {
      actions.push({ kind: "mark_missing", entityId });
      continue;
    }

    if (nowMs - missingSinceMs >= ARMY_RECS_MISSING_CONFIRM_MS) {
      actions.push({ kind: "remove_dead", entityId, cause: "missing_component" });
    }
  }

  return actions;
}
