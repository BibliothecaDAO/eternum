import { ID } from "@bibliothecadao/types";

export type TravelEffectType = "travel" | "compass";

export interface TrackedTravelEffect {
  key: string;
  effectType: TravelEffectType;
}

interface ResolveExploreCompletionPendingClearPlanInput {
  exploredHexKey: string;
  trackedEffectsByEntity: ReadonlyMap<ID, TrackedTravelEffect>;
  pendingArmyMovements: ReadonlySet<ID>;
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
