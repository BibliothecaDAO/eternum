import { createManagerVisibilityDiff } from "./manager-visibility-diff";

interface ReconcileVisibleArmySetInput<TArmy extends { entityId: TEntityId }, TModelType, TEntityId> {
  desiredVisibleArmies: TArmy[];
  modelTypesByEntity: Map<TEntityId, TModelType>;
  forceRefresh?: boolean;
  currentVisibleOrder: TEntityId[];
  forEachTrackedLabel: (visit: (entityId: TEntityId) => void) => void;
  getVisibleArmySlot: (entityId: TEntityId) => number | undefined;
  removeVisibleArmy: (entityId: TEntityId) => number | null;
  addVisibleArmy: (army: TArmy, modelType: TModelType) => void;
  refreshVisibleArmy: (army: TArmy, slot: number, modelType: TModelType) => void;
  removeEntityIdLabel: (entityId: TEntityId) => void;
  commitVisibleArmyOrder: (entityIds: TEntityId[]) => void;
  markVisibleArmyPresentationDirty: (buffersDirty: boolean) => void;
  sortEntityIds: (entityIds: TEntityId[]) => TEntityId[];
}

export function reconcileVisibleArmySet<TArmy extends { entityId: TEntityId }, TModelType, TEntityId>(
  input: ReconcileVisibleArmySetInput<TArmy, TModelType, TEntityId>,
): void {
  const desiredOrder = input.desiredVisibleArmies.map((army) => army.entityId);
  const visibilityDiff = createManagerVisibilityDiff({
    currentVisibleIds: input.currentVisibleOrder,
    nextVisibleEntities: input.desiredVisibleArmies,
    getEntityId: (army) => army.entityId,
  });
  const staleVisibleArmies = input.sortEntityIds(visibilityDiff.leaving);
  let buffersDirty = false;

  staleVisibleArmies.forEach((entityId) => {
    if (input.removeVisibleArmy(entityId) !== null) {
      buffersDirty = true;
    }
  });

  visibilityDiff.entering.forEach((army) => {
    const modelType = input.modelTypesByEntity.get(army.entityId);
    if (!modelType) {
      return;
    }

    input.addVisibleArmy(army, modelType);
    buffersDirty = true;
  });

  if (input.forceRefresh) {
    input.desiredVisibleArmies.forEach((army) => {
      const slot = input.getVisibleArmySlot(army.entityId);
      const modelType = input.modelTypesByEntity.get(army.entityId);
      if (slot === undefined || !modelType) {
        return;
      }

      input.refreshVisibleArmy(army, slot, modelType);
      buffersDirty = true;
    });
  }

  const visibleArmySet = new Set(input.currentVisibleOrder);
  input.forEachTrackedLabel((entityId) => {
    if (!visibleArmySet.has(entityId)) {
      input.removeEntityIdLabel(entityId);
    }
  });

  input.commitVisibleArmyOrder(desiredOrder.filter((entityId) => input.getVisibleArmySlot(entityId) !== undefined));
  input.markVisibleArmyPresentationDirty(buffersDirty);
}
