import { describe, expect, it } from "vitest";
import { resolveDuplicateTileReconcilePlan } from "./worldmap-chunk-transition";

/**
 * Integration-level tests for the duplicate tile reconcile flow.
 *
 * These tests verify the POLICY layer that prevents biome delta data loss
 * when a duplicate tile update arrives. The critical bug: the caller in
 * worldmap.tsx early-returns BEFORE writing the biome to `exploredTiles`
 * when the reconcile plan does not signal authoritative state update.
 *
 * Stage 0 RED tests: all of these should FAIL until the implementation
 * adds `shouldUpdateAuthoritativeState` to the reconcile plan.
 */

describe("duplicate tile biome delta – authoritative state convergence", () => {
  it("duplicate tile with biome delta updates authoritative explored state before reconcile scheduling", () => {
    const plan = resolveDuplicateTileReconcilePlan({
      removeExplored: false,
      tileAlreadyKnown: true,
      hasBiomeDelta: true,
      currentChunk: "24,24",
      isChunkTransitioning: false,
      isVisibleInCurrentChunk: true,
    });

    // The plan MUST signal that the authoritative explored state needs to be
    // written BEFORE any reconcile scheduling or early-return. Without this,
    // the biome delta is silently dropped.
    expect(plan).toHaveProperty("shouldUpdateAuthoritativeState", true);
    expect(plan.shouldInvalidateCaches).toBe(true);
    expect(plan.refreshStrategy).toBe("immediate");
  });

  it("repeated duplicate updates do not create refresh storms", () => {
    const baseInput = {
      removeExplored: false,
      tileAlreadyKnown: true,
      hasBiomeDelta: true,
      currentChunk: "24,24",
      isChunkTransitioning: false,
      isVisibleInCurrentChunk: true,
    } as const;

    // Simulate 5 rapid duplicate tile updates for the same tile
    const plans = Array.from({ length: 5 }, () => resolveDuplicateTileReconcilePlan(baseInput));

    // Every plan signals authoritative update, but the refresh strategy
    // should be "immediate" only — not escalating to something heavier.
    // The caller is responsible for deduplicating actual refresh calls.
    for (const plan of plans) {
      expect(plan).toHaveProperty("shouldUpdateAuthoritativeState", true);
      expect(plan.refreshStrategy).toBe("immediate");
    }

    // The plan must NOT contain a field that would cause exponential retry
    // or unbounded refresh scheduling.
    for (const plan of plans) {
      expect(plan).not.toHaveProperty("retryCount");
      expect(plan).not.toHaveProperty("forceFullRebuild");
    }
  });

  it("duplicate biome delta converges terrain state after one atomic refresh", () => {
    // First update: biome delta arrives on a known tile
    const firstPlan = resolveDuplicateTileReconcilePlan({
      removeExplored: false,
      tileAlreadyKnown: true,
      hasBiomeDelta: true,
      currentChunk: "24,24",
      isChunkTransitioning: false,
      isVisibleInCurrentChunk: true,
    });

    expect(firstPlan).toHaveProperty("shouldUpdateAuthoritativeState", true);
    expect(firstPlan.refreshStrategy).toBe("immediate");

    // After the authoritative state has been updated, a second duplicate
    // for the SAME biome (no longer a delta) should NOT require another
    // authoritative update — the state has converged.
    const convergedPlan = resolveDuplicateTileReconcilePlan({
      removeExplored: false,
      tileAlreadyKnown: true,
      hasBiomeDelta: false,
      currentChunk: "24,24",
      isChunkTransitioning: false,
      isVisibleInCurrentChunk: true,
    });

    expect(convergedPlan).toHaveProperty("shouldUpdateAuthoritativeState", false);
  });
});

describe("Stage 3: duplicate tile reconcile mode convergence", () => {
  it("repeated same-biome visible duplicates choose atomic refresh until visible membership can be proven", () => {
    const baseInput = {
      removeExplored: false,
      tileAlreadyKnown: true,
      hasBiomeDelta: false,
      currentChunk: "24,24",
      isChunkTransitioning: false,
      isVisibleInCurrentChunk: true,
    } as const;

    // Simulate 10 rapid same-biome visible duplicate tile updates
    const plans = Array.from({ length: 10 }, () => resolveDuplicateTileReconcilePlan(baseInput));

    // Phase one correctness rule: if the runtime cannot prove the tile is
    // already present in the visible terrain snapshot, a visible duplicate
    // must repair through the atomic presentation path.
    for (const plan of plans) {
      expect(plan.reconcileMode).toBe("atomic_chunk_refresh");
      expect(plan.refreshStrategy).toBe("deferred");
      expect(plan.shouldInvalidateCaches).toBe(true);
      expect(plan.shouldUpdateAuthoritativeState).toBe(false);
    }
  });
});
