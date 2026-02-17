import { describe, expect, it } from "vitest";
import { createWorldmapUpdateExploredHexFixture } from "./worldmap-update-explored-hex-fixture";

describe("Worldmap updateExploredHex integration wiring", () => {
  it("triggers immediate chunk refresh when duplicate reconcile strategy is immediate", async () => {
    const fixture = createWorldmapUpdateExploredHexFixture();

    await fixture.applyDuplicateReconcilePlan({
      shouldInvalidateCaches: true,
      refreshStrategy: "immediate",
    });

    expect(fixture.invalidateCalls).toBe(1);
    expect(fixture.updateVisibleChunksCalls).toEqual([true]);
    expect(fixture.requestChunkRefreshCalls).toEqual([]);
  });

  it("requests deferred chunk refresh when duplicate reconcile strategy is deferred", async () => {
    const fixture = createWorldmapUpdateExploredHexFixture();

    await fixture.applyDuplicateReconcilePlan({
      shouldInvalidateCaches: true,
      refreshStrategy: "deferred",
    });

    expect(fixture.invalidateCalls).toBe(1);
    expect(fixture.updateVisibleChunksCalls).toEqual([]);
    expect(fixture.requestChunkRefreshCalls).toEqual([true]);
  });

  it("does not request any refresh when duplicate reconcile strategy is none", async () => {
    const fixture = createWorldmapUpdateExploredHexFixture();

    await fixture.applyDuplicateReconcilePlan({
      shouldInvalidateCaches: false,
      refreshStrategy: "none",
    });

    expect(fixture.invalidateCalls).toBe(0);
    expect(fixture.updateVisibleChunksCalls).toEqual([]);
    expect(fixture.requestChunkRefreshCalls).toEqual([]);
  });
});
