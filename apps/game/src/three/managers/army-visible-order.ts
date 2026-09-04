export interface VisibleArmyOrderState<TId> {
  order: TId[];
  indices: Map<TId, number>;
}

export function createVisibleArmyOrderState<TId>(): VisibleArmyOrderState<TId> {
  return {
    order: [],
    indices: new Map(),
  };
}

export function addVisibleArmyOrderEntry<TId>(state: VisibleArmyOrderState<TId>, entityId: TId): boolean {
  if (state.indices.has(entityId)) {
    return false;
  }

  state.order.push(entityId);
  state.indices.set(entityId, state.order.length - 1);
  return true;
}

export function removeVisibleArmyOrderEntry<TId>(
  state: VisibleArmyOrderState<TId>,
  entityId: TId,
): { removed: boolean; swappedEntityId?: TId } {
  const orderIndex = state.indices.get(entityId);
  if (orderIndex === undefined) {
    return { removed: false };
  }

  const lastIndex = state.order.length - 1;
  const swappedEntityId = state.order[lastIndex];

  state.indices.delete(entityId);

  if (orderIndex !== lastIndex) {
    state.order[orderIndex] = swappedEntityId;
    state.indices.set(swappedEntityId, orderIndex);
  }

  state.order.pop();

  return {
    removed: true,
    swappedEntityId: orderIndex !== lastIndex ? swappedEntityId : undefined,
  };
}

export function replaceVisibleArmyOrder<TId>(state: VisibleArmyOrderState<TId>, order: TId[]): void {
  state.order = [...order];
  state.indices = new Map(order.map((entityId, index) => [entityId, index]));
}
