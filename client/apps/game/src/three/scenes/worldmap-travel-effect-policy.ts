import type { ID } from "@bibliothecadao/types";

export type TravelEffectType = "travel" | "compass";
export type PendingArmyMovementEffectClearReason =
  | "movement_started"
  | "cleanup_requested"
  | "authoritative_reconciled";

export interface TrackedTravelEffect {
  key: string;
  effectType: TravelEffectType;
}

interface ResolveExploreCompletionPendingClearPlanInput {
  exploredHexKey: string;
  trackedEffectsByEntity: ReadonlyMap<ID, TrackedTravelEffect>;
  pendingArmyMovements: ReadonlySet<ID>;
}

interface ResolvePendingMovementAuthoritativeResolutionPlanInput {
  pendingTargetKey?: string;
  authoritativePositionKey: string;
  isMovementInFlight: boolean;
}

interface PendingMovementAuthoritativeResolutionPlan {
  shouldClearPendingMovement: boolean;
  shouldClearAfterVisualCompletion: boolean;
}

/**
 * Exploring can complete without an onchain position change when the revealed tile has a structure.
 * In that case, clear only pending compass effects for the explored tile.
 */
export function resolveExploreCompletionPendingClearPlan(input: ResolveExploreCompletionPendingClearPlanInput): ID[] {
  const pendingEntityIdsToClear: ID[] = [];

  for (const [entityId, trackedEffect] of input.trackedEffectsByEntity.entries()) {
    if (trackedEffect.key !== input.exploredHexKey) {
      continue;
    }

    if (trackedEffect.effectType !== "compass") {
      continue;
    }

    if (!input.pendingArmyMovements.has(entityId)) {
      continue;
    }

    pendingEntityIdsToClear.push(entityId);
  }

  return pendingEntityIdsToClear;
}

export function shouldCleanupTrackedTravelEffectOnPendingClear(input: {
  trackedEffect?: TrackedTravelEffect;
  reason: PendingArmyMovementEffectClearReason;
}): boolean {
  if (!input.trackedEffect) {
    return false;
  }

  if (input.reason === "movement_started") {
    return input.trackedEffect.effectType !== "travel";
  }

  return true;
}

export function resolvePendingMovementAuthoritativeResolutionPlan(
  input: ResolvePendingMovementAuthoritativeResolutionPlanInput,
): PendingMovementAuthoritativeResolutionPlan {
  if (!input.pendingTargetKey) {
    return {
      shouldClearPendingMovement: false,
      shouldClearAfterVisualCompletion: false,
    };
  }

  if (input.pendingTargetKey !== input.authoritativePositionKey) {
    return {
      shouldClearPendingMovement: false,
      shouldClearAfterVisualCompletion: false,
    };
  }

  if (input.isMovementInFlight) {
    return {
      shouldClearPendingMovement: false,
      shouldClearAfterVisualCompletion: true,
    };
  }

  return {
    shouldClearPendingMovement: true,
    shouldClearAfterVisualCompletion: false,
  };
}

export function shouldClearPendingMovementOnAuthoritativePosition(
  input: ResolvePendingMovementAuthoritativeResolutionPlanInput,
): boolean {
  return resolvePendingMovementAuthoritativeResolutionPlan(input).shouldClearPendingMovement;
}
