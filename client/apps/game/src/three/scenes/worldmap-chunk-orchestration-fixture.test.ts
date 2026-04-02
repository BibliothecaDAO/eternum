import { describe, expect, it } from "vitest";
import { createWorldmapChunkOrchestrationFixture } from "./worldmap-chunk-orchestration-fixture";
import { flushMicrotasks } from "./worldmap-test-harness";
import type { WorldmapBarrierResult } from "./worldmap-authoritative-barrier";

function readyBarrier(label: string): WorldmapBarrierResult {
  return { status: "ready", label, durationMs: 0 };
}

function timedOutBarrier(label: string): WorldmapBarrierResult {
  return { status: "timed_out", label, durationMs: 500 };
}

describe("createWorldmapChunkOrchestrationFixture", () => {
  it("keeps the previous chunk active until the critical presentation barriers are ready without waiting for deferred prewarm", async () => {
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
    expect(fixture.tileFetch.calls).toEqual([["24,24"]]);
    expect(fixture.tileHydration.calls).toEqual([["24,24"]]);
    expect(fixture.boundsSwitch.calls).toEqual([["24,24", 7]]);
    expect(fixture.structureHydration.calls).toEqual([["24,24"]]);
    expect(fixture.assetPrewarm.calls).toEqual([["24,24"]]);
    expect(fixture.terrainPreparation.calls).toEqual([]);
    expect(fixture.managerUpdate.calls).toEqual([]);

    fixture.tileFetch.resolveNext(true);
    fixture.tileHydration.resolveNext(readyBarrier("tile_authoritative"));
    fixture.boundsSwitch.resolveNext();
    await flushMicrotasks(2);

    expect(fixture.terrainPreparation.calls).toEqual([]);
    expect(fixture.getCurrentChunk()).toBe("0,0");

    fixture.structureHydration.resolveNext(readyBarrier("structure_authoritative"));
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
      tileFetchSucceeded: true,
      committedManagers: true,
      rolledBack: false,
      unregisteredPreviousChunk: true,
      committedChunk: "24,24",
      presentationStatus: "ready",
    });
    expect(fixture.getCurrentChunk()).toBe("24,24");

    fixture.assetPrewarm.resolveNext();
  });

  it("rolls back to previous authority when tile fetch fails", async () => {
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
    fixture.tileFetch.resolveNext(false);
    fixture.tileHydration.resolveNext(readyBarrier("tile_authoritative"));
    fixture.boundsSwitch.resolveNext();
    fixture.structureHydration.resolveNext(readyBarrier("structure_authoritative"));

    const result = await switchPromise;
    expect(result).toEqual({
      tileFetchSucceeded: false,
      committedManagers: false,
      rolledBack: true,
      unregisteredPreviousChunk: false,
      committedChunk: "0,0",
      presentationStatus: "fetch_failed",
    });
    expect(fixture.managerUpdate.calls).toEqual([]);
    expect(fixture.getCurrentChunk()).toBe("0,0");

    fixture.assetPrewarm.resolveNext();
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
    fixture.tileFetch.resolveNext(true);
    fixture.tileHydration.resolveNext(readyBarrier("tile_authoritative"));
    fixture.boundsSwitch.resolveNext();
    fixture.structureHydration.resolveNext(readyBarrier("structure_authoritative"));
    await flushMicrotasks(2);
    fixture.terrainPreparation.resolveNext({ chunkKey: "24,24" });

    const result = await switchPromise;
    expect(result).toEqual({
      tileFetchSucceeded: true,
      committedManagers: false,
      rolledBack: false,
      unregisteredPreviousChunk: false,
      committedChunk: "0,0",
      presentationStatus: "ready",
    });
    expect(fixture.managerUpdate.calls).toEqual([]);
    expect(fixture.getCurrentChunk()).toBe("0,0");

    fixture.assetPrewarm.resolveNext();
  });

  it("rolls back on authoritative timeout and lets a later chunk switch proceed", async () => {
    const fixture = createWorldmapChunkOrchestrationFixture();

    const northwardSwitch = fixture.runChunkSwitch({
      chunkKey: "24,0",
      startRow: 24,
      startCol: 0,
      force: false,
      transitionToken: 12,
      isCurrentTransition: true,
      previousChunk: "0,0",
      currentChunk: "0,0",
    });

    await flushMicrotasks(2);
    fixture.tileFetch.resolveNext(true);
    fixture.tileHydration.resolveNext(readyBarrier("tile_authoritative"));
    fixture.boundsSwitch.resolveNext();
    fixture.structureHydration.resolveNext(timedOutBarrier("structure_authoritative"));

    const timedOutResult = await northwardSwitch;
    expect(timedOutResult).toEqual({
      tileFetchSucceeded: true,
      committedManagers: false,
      rolledBack: true,
      unregisteredPreviousChunk: false,
      committedChunk: "0,0",
      presentationStatus: "timed_out",
    });
    expect(fixture.getCurrentChunk()).toBe("0,0");
    expect(fixture.managerUpdate.calls).toEqual([]);

    fixture.assetPrewarm.resolveNext();

    const southwardSwitch = fixture.runChunkSwitch({
      chunkKey: "-24,0",
      startRow: -24,
      startCol: 0,
      force: false,
      transitionToken: 13,
      isCurrentTransition: true,
      previousChunk: "0,0",
      currentChunk: fixture.getCurrentChunk(),
    });

    await flushMicrotasks(2);
    fixture.tileFetch.resolveNext(true);
    fixture.tileHydration.resolveNext(readyBarrier("tile_authoritative"));
    fixture.boundsSwitch.resolveNext();
    fixture.structureHydration.resolveNext(readyBarrier("structure_authoritative"));
    await flushMicrotasks(2);
    fixture.terrainPreparation.resolveNext({ chunkKey: "-24,0" });
    await flushMicrotasks(2);
    fixture.managerUpdate.resolveNext();

    const southwardResult = await southwardSwitch;
    expect(southwardResult).toEqual({
      tileFetchSucceeded: true,
      committedManagers: true,
      rolledBack: false,
      unregisteredPreviousChunk: true,
      committedChunk: "-24,0",
      presentationStatus: "ready",
    });
    expect(fixture.getCurrentChunk()).toBe("-24,0");

    fixture.assetPrewarm.resolveNext();
  });
});
