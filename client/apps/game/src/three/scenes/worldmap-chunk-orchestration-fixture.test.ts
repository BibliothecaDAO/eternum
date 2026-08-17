import { describe, expect, it } from "vitest";
import { createWorldmapChunkOrchestrationFixture } from "./worldmap-chunk-orchestration-fixture";
import { flushMicrotasks } from "./worldmap-test-harness";

describe("createWorldmapChunkOrchestrationFixture", () => {
  it("keeps the previous chunk active until the prepared presentation is ready to commit", async () => {
    const fixture = createWorldmapChunkOrchestrationFixture();

    const switchPromise = fixture.runChunkSwitch({
      chunkKey: "24,24",
      startRow: 24,
      startCol: 24,
      force: false,
      transitionToken: 7,
      isCurrentTransition: true,
      previousChunk: "0,0",
      currentChunk: "0,0",
    });

    await flushMicrotasks(2);

    expect(fixture.getCurrentChunk()).toBe("0,0");
    expect(fixture.projectionSync.calls).toEqual([["24,24"]]);
    expect(fixture.assetPrewarm.calls).toEqual([["24,24"]]);
    expect(fixture.terrainPreparation.calls).toEqual([]);
    expect(fixture.managerUpdate.calls).toEqual([]);

    fixture.projectionSync.resolveNext(true);
    await flushMicrotasks(2);
    expect(fixture.terrainPreparation.calls).toEqual([]);
    expect(fixture.getCurrentChunk()).toBe("0,0");

    fixture.assetPrewarm.resolveNext();
    await flushMicrotasks(2);

    expect(fixture.terrainPreparation.calls).toEqual([[24, 24]]);
    expect(fixture.getCurrentChunk()).toBe("0,0");
    expect(fixture.managerUpdate.calls).toEqual([]);

    fixture.terrainPreparation.resolveNext({ chunkKey: "24,24" });

    for (let i = 0; i < 5 && fixture.managerUpdate.pendingCount() === 0; i += 1) {
      await flushMicrotasks();
    }

    expect(fixture.managerUpdate.pendingCount()).toBe(1);
    expect(fixture.managerUpdate.calls).toEqual([["24,24", { force: false, transitionToken: 7 }]]);
    fixture.managerUpdate.resolveNext();

    const result = await switchPromise;
    expect(result).toEqual({
      projectionSyncSucceeded: true,
      committedManagers: true,
      rolledBack: false,
      unregisteredPreviousChunk: true,
      committedChunk: "24,24",
    });
    expect(fixture.getCurrentChunk()).toBe("24,24");
  });

  it("rolls back to previous authority when tile sync fails", async () => {
    const fixture = createWorldmapChunkOrchestrationFixture();

    const switchPromise = fixture.runChunkSwitch({
      chunkKey: "24,24",
      startRow: 24,
      startCol: 24,
      force: false,
      transitionToken: 9,
      isCurrentTransition: true,
      previousChunk: "0,0",
      currentChunk: "0,0",
    });

    await flushMicrotasks(2);
    expect(fixture.getCurrentChunk()).toBe("0,0");
    fixture.assetPrewarm.resolveNext();
    fixture.projectionSync.resolveNext(false);

    const result = await switchPromise;
    expect(result).toEqual({
      projectionSyncSucceeded: false,
      committedManagers: false,
      rolledBack: true,
      unregisteredPreviousChunk: false,
      committedChunk: "0,0",
    });
    expect(fixture.managerUpdate.calls).toEqual([]);
    expect(fixture.getCurrentChunk()).toBe("0,0");
  });

  it("suppresses stale transition commits and manager updates", async () => {
    const fixture = createWorldmapChunkOrchestrationFixture();

    const switchPromise = fixture.runChunkSwitch({
      chunkKey: "24,24",
      startRow: 24,
      startCol: 24,
      force: false,
      transitionToken: 11,
      isCurrentTransition: false,
      previousChunk: "0,0",
      currentChunk: "0,0",
    });

    await flushMicrotasks(2);
    fixture.assetPrewarm.resolveNext();
    fixture.projectionSync.resolveNext(true);
    await flushMicrotasks(2);
    fixture.terrainPreparation.resolveNext({ chunkKey: "24,24" });

    const result = await switchPromise;
    expect(result).toEqual({
      projectionSyncSucceeded: true,
      committedManagers: false,
      rolledBack: false,
      unregisteredPreviousChunk: false,
      committedChunk: "0,0",
    });
    expect(fixture.managerUpdate.calls).toEqual([]);
    expect(fixture.getCurrentChunk()).toBe("0,0");
  });
});
