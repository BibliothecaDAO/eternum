export interface ManagerVisibilityDiff<TEntity, TEntityId> {
  entering: TEntity[];
  leaving: TEntityId[];
  staying: TEntityId[];
  visibleIds: TEntityId[];
}

interface CreateManagerVisibilityDiffInput<TEntity, TEntityId> {
  currentVisibleIds: Iterable<TEntityId>;
  nextVisibleEntities: readonly TEntity[];
  getEntityId: (entity: TEntity) => TEntityId;
  refreshExisting?: boolean;
}

interface CommitManagerVisibilityDiffInput<TEntity, TEntityId> {
  diff: ManagerVisibilityDiff<TEntity, TEntityId>;
  isCurrent: () => boolean;
  remove: (entityId: TEntityId) => void;
  add: (entity: TEntity) => void;
  commitVisibleIds: (visibleIds: TEntityId[]) => void;
}

export function createManagerVisibilityDiff<TEntity, TEntityId>(
  input: CreateManagerVisibilityDiffInput<TEntity, TEntityId>,
): ManagerVisibilityDiff<TEntity, TEntityId> {
  const currentVisibleIds = [...input.currentVisibleIds];
  const currentVisibleSet = new Set(currentVisibleIds);
  const visibleIds = input.nextVisibleEntities.map(input.getEntityId);
  const nextVisibleSet = new Set(visibleIds);

  if (input.refreshExisting) {
    return {
      entering: [...input.nextVisibleEntities],
      leaving: currentVisibleIds,
      staying: [],
      visibleIds,
    };
  }

  return {
    entering: input.nextVisibleEntities.filter((entity) => !currentVisibleSet.has(input.getEntityId(entity))),
    leaving: currentVisibleIds.filter((entityId) => !nextVisibleSet.has(entityId)),
    staying: visibleIds.filter((entityId) => currentVisibleSet.has(entityId)),
    visibleIds,
  };
}

export function commitManagerVisibilityDiff<TEntity, TEntityId>(
  input: CommitManagerVisibilityDiffInput<TEntity, TEntityId>,
): boolean {
  if (!input.isCurrent()) {
    return false;
  }

  input.diff.leaving.forEach(input.remove);
  input.diff.entering.forEach(input.add);
  input.commitVisibleIds(input.diff.visibleIds);
  return true;
}
