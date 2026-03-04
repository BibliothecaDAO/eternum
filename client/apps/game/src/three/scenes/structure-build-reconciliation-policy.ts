import { type BuildingType, type ID } from "@bibliothecadao/types";

interface StructureBuildProduction {
  buildingType: BuildingType;
  buildingCount: number;
}

interface StructureBuildsUpdate {
  entityId: ID;
  activeProductions: StructureBuildProduction[];
}

export interface StructureBuildReconciliationSubscriptionState {
  hasSubscribed: boolean;
}

interface EnsureStructureBuildReconciliationSubscriptionInput {
  state: StructureBuildReconciliationSubscriptionState;
  subscribe: (callback: (update: StructureBuildsUpdate) => void) => void;
  reconcile: (structureEntityId: ID, activeProductions: StructureBuildProduction[]) => number;
}

/**
 * Ensure we only register one reconciliation subscription per scene instance.
 * World update listener subscriptions are long-lived, so repeated setup calls
 * must not register duplicate callbacks.
 */
export function ensureStructureBuildReconciliationSubscription(
  input: EnsureStructureBuildReconciliationSubscriptionInput,
): boolean {
  if (input.state.hasSubscribed) {
    return false;
  }

  input.subscribe((update) => {
    if (!update || update.entityId === undefined || !Array.isArray(update.activeProductions)) {
      return;
    }

    input.reconcile(update.entityId, update.activeProductions);
  });

  input.state.hasSubscribed = true;
  return true;
}
