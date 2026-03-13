type RefreshStrategy = "none" | "deferred" | "immediate";

interface DuplicateReconcilePlanInput {
  shouldInvalidateCaches: boolean;
  refreshStrategy: RefreshStrategy;
}

interface WorldmapUpdateExploredHexFixture {
  invalidateCalls: number;
  updateVisibleChunksCalls: boolean[];
  requestChunkRefreshCalls: Array<{ force: boolean; reason: string }>;
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

      if (plan.refreshStrategy === "deferred" || plan.refreshStrategy === "immediate") {
        fixture.requestChunkRefreshCalls.push({ force: true, reason: "duplicate_tile" });
        return;
      }
    },
  };

  return fixture;
}
