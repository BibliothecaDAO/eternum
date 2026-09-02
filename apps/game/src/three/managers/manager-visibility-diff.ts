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
  refreshEntityIds?: Iterable<TEntityId>;
  refreshExisting?: boolean;
}

interface CommitManagerVisibilityDiffInput<TEntity, TEntityId> {
  diff: ManagerVisibilityDiff<TEntity, TEntityId>;
  isCurrent: () => boolean;
  remove: (entityId: TEntityId) => void;
  add: (entity: TEntity) => void;
  commitVisibleIds: (visibleIds: TEntityId[]) => void;
}

interface CommitManagerVisibilityDiffSlicedInput<TEntity, TEntityId> extends CommitManagerVisibilityDiffInput<
  TEntity,
  TEntityId
> {
  getEntityId: (entity: TEntity) => TEntityId;
  /** Runs one slice as its own queue task; the frame-budget queue never splits a task. */
  schedule: <T>(work: () => T, owner: string) => Promise<T>;
  owner: string;
  sliceBudgetMs: number;
  now?: () => number;
  beginSlice?: () => void;
  endSlice?: (sliceMs: number) => void;
}

type VisibilityDiffSliceOutcome = "continue" | "done" | "superseded";

/**
 * Work order for a sliced commit. Refreshed entities (in both `leaving` and `entering`) are
 * removed and re-added inside one slice so no structure blinks out between frames; leaving-only
 * removals go first so their freed slots are reused by the adds that follow.
 */
interface VisibilityDiffWorkPlan<TEntity, TEntityId> {
  leavingOnly: TEntityId[];
  refresh: TEntity[];
  enteringOnly: TEntity[];
}

interface VisibilityDiffCursor {
  leavingOnly: number;
  refresh: number;
  enteringOnly: number;
}

export function createManagerVisibilityDiff<TEntity, TEntityId>(
  input: CreateManagerVisibilityDiffInput<TEntity, TEntityId>,
): ManagerVisibilityDiff<TEntity, TEntityId> {
  const currentVisibleIds = [...input.currentVisibleIds];
  const currentVisibleSet = new Set(currentVisibleIds);
  const visibleIds = input.nextVisibleEntities.map(input.getEntityId);
  const nextVisibleSet = new Set(visibleIds);
  const refreshEntityIds = new Set(input.refreshEntityIds);

  if (input.refreshExisting) {
    return {
      entering: [...input.nextVisibleEntities],
      leaving: currentVisibleIds,
      staying: [],
      visibleIds,
    };
  }

  return {
    entering: input.nextVisibleEntities.filter((entity) => {
      const entityId = input.getEntityId(entity);
      return !currentVisibleSet.has(entityId) || refreshEntityIds.has(entityId);
    }),
    leaving: currentVisibleIds.filter((entityId) => !nextVisibleSet.has(entityId) || refreshEntityIds.has(entityId)),
    staying: visibleIds.filter((entityId) => currentVisibleSet.has(entityId) && !refreshEntityIds.has(entityId)),
    visibleIds,
  };
}

/** One task: a single player event stays one visible step. */
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

/**
 * Bulk variant: the diff is committed in time-boxed slices, each scheduled as its own task under
 * `owner`, with `isCurrent` re-checked at the start of every slice so a superseded pass stops.
 * `commitVisibleIds` runs once, after the last slice. Resolves false when superseded.
 */
export async function commitManagerVisibilityDiffSliced<TEntity, TEntityId>(
  input: CommitManagerVisibilityDiffSlicedInput<TEntity, TEntityId>,
): Promise<boolean> {
  const plan = planVisibilityDiffWork(input.diff, input.getEntityId);
  const cursor: VisibilityDiffCursor = { leavingOnly: 0, refresh: 0, enteringOnly: 0 };

  for (;;) {
    const outcome = await input.schedule(() => runVisibilityDiffSlice(input, plan, cursor), input.owner);
    if (outcome !== "continue") {
      return outcome === "done";
    }
  }
}

function planVisibilityDiffWork<TEntity, TEntityId>(
  diff: ManagerVisibilityDiff<TEntity, TEntityId>,
  getEntityId: (entity: TEntity) => TEntityId,
): VisibilityDiffWorkPlan<TEntity, TEntityId> {
  const leavingSet = new Set(diff.leaving);
  const refresh = diff.entering.filter((entity) => leavingSet.has(getEntityId(entity)));
  const refreshIds = new Set(refresh.map(getEntityId));

  return {
    leavingOnly: diff.leaving.filter((entityId) => !refreshIds.has(entityId)),
    refresh,
    enteringOnly: diff.entering.filter((entity) => !refreshIds.has(getEntityId(entity))),
  };
}

function runVisibilityDiffSlice<TEntity, TEntityId>(
  input: CommitManagerVisibilityDiffSlicedInput<TEntity, TEntityId>,
  plan: VisibilityDiffWorkPlan<TEntity, TEntityId>,
  cursor: VisibilityDiffCursor,
): VisibilityDiffSliceOutcome {
  if (!input.isCurrent()) {
    return "superseded";
  }

  const now = input.now ?? defaultNow;
  const sliceStartedAt = now();
  input.beginSlice?.();
  try {
    while (applyNextVisibilityDiffUnit(input, plan, cursor)) {
      if (hasVisibilityDiffWork(plan, cursor) && now() - sliceStartedAt >= input.sliceBudgetMs) {
        return "continue";
      }
    }
    input.commitVisibleIds(input.diff.visibleIds);
    return "done";
  } finally {
    input.endSlice?.(now() - sliceStartedAt);
  }
}

/** Applies one entity's work and advances the cursor; false once the plan is exhausted. */
function applyNextVisibilityDiffUnit<TEntity, TEntityId>(
  input: CommitManagerVisibilityDiffSlicedInput<TEntity, TEntityId>,
  plan: VisibilityDiffWorkPlan<TEntity, TEntityId>,
  cursor: VisibilityDiffCursor,
): boolean {
  if (cursor.leavingOnly < plan.leavingOnly.length) {
    input.remove(plan.leavingOnly[cursor.leavingOnly++]);
    return true;
  }
  if (cursor.refresh < plan.refresh.length) {
    const entity = plan.refresh[cursor.refresh++];
    input.remove(input.getEntityId(entity));
    input.add(entity);
    return true;
  }
  if (cursor.enteringOnly < plan.enteringOnly.length) {
    input.add(plan.enteringOnly[cursor.enteringOnly++]);
    return true;
  }
  return false;
}

function hasVisibilityDiffWork<TEntity, TEntityId>(
  plan: VisibilityDiffWorkPlan<TEntity, TEntityId>,
  cursor: VisibilityDiffCursor,
): boolean {
  return (
    cursor.leavingOnly < plan.leavingOnly.length ||
    cursor.refresh < plan.refresh.length ||
    cursor.enteringOnly < plan.enteringOnly.length
  );
}

function defaultNow(): number {
  return performance.now();
}
