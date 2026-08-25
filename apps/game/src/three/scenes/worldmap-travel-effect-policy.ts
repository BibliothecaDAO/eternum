import type { ID } from "@bibliothecadao/types";

export type TravelEffectType = "travel" | "compass";
export type MovementEffectClearReason = "movement_started" | "cleanup_requested";

export interface TrackedTravelEffect {
  key: string;
  effectType: TravelEffectType;
}

interface ResolveExploreCompletionVisualCleanupInput {
  activeMovementVisuals: ReadonlySet<ID>;
  exploredHexKey: string;
  trackedEffectsByEntity: ReadonlyMap<ID, TrackedTravelEffect>;
}

/**
 * Exploring can complete without an onchain position change when the revealed tile has a structure.
 * In that case, clear only pending compass effects for the explored tile.
 */
export function resolveExploreCompletionVisualCleanup(input: ResolveExploreCompletionVisualCleanupInput): ID[] {
  const pendingEntityIdsToClear: ID[] = [];

  for (const [entityId, trackedEffect] of input.trackedEffectsByEntity.entries()) {
    if (trackedEffect.key !== input.exploredHexKey) {
      continue;
    }

    if (trackedEffect.effectType !== "compass") {
      continue;
    }

    if (!input.activeMovementVisuals.has(entityId)) {
      continue;
    }

    pendingEntityIdsToClear.push(entityId);
  }

  return pendingEntityIdsToClear;
}

export function shouldCleanupTrackedTravelEffect(input: {
  trackedEffect?: TrackedTravelEffect;
  reason: MovementEffectClearReason;
}): boolean {
  if (!input.trackedEffect) {
    return false;
  }

  if (input.reason === "movement_started") {
    return input.trackedEffect.effectType !== "travel";
  }

  return true;
}
