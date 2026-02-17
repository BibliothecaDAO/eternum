type RefreshStrategy = "none" | "deferred" | "immediate";

interface DuplicateReconcilePlanInput {
  shouldInvalidateCaches: boolean;
  refreshStrategy: RefreshStrategy;
}

interface WorldmapUpdateExploredHexFixture {
  invalidateCalls: number;
  updateVisibleChunksCalls: boolean[];
  requestChunkRefreshCalls: boolean[];
  applyDuplicateReconcilePlan: (plan: DuplicateReconcilePlanInput) => Promise<void>;
}

export function createWorldmapUpdateExploredHexFixture(): WorldmapUpdateExploredHexFixture {
  const fixture: WorldmapUpdateExploredHexFixture = {
    invalidateCalls: 0,
    updateVisibleChunksCalls: [],
    requestChunkRefreshCalls: [],
    async applyDuplicateReconcilePlan(plan: DuplicateReconcilePlanInput): Promise<void> {
      if (!plan.shouldInvalidateCaches) {
        return;
      }

      fixture.invalidateCalls += 1;

      if (plan.refreshStrategy === "immediate") {
        fixture.updateVisibleChunksCalls.push(true);
        return;
      }

      if (plan.refreshStrategy === "deferred") {
        fixture.requestChunkRefreshCalls.push(true);
      }
    },
  };

  return fixture;
}

