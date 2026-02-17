import { describe, expect, it } from "vitest";
import { createWorldmapChunkOrchestrationFixture } from "./worldmap-chunk-orchestration-fixture";
import { flushMicrotasks } from "./worldmap-test-harness";

describe("createWorldmapChunkOrchestrationFixture", () => {
  it("commits chunk authority only after successful performChunkSwitch commit path", async () => {
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
    expect(fixture.boundsSwitch.calls).toEqual([["24,24", 7]]);
    expect(fixture.gridUpdate.calls).toEqual([[24, 24]]);
    expect(fixture.managerUpdate.calls).toEqual([]);

    fixture.gridUpdate.resolveNext();
    fixture.tileFetch.resolveNext(true);
    fixture.boundsSwitch.resolveNext();

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
    });
    expect(fixture.getCurrentChunk()).toBe("24,24");
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
    fixture.gridUpdate.resolveNext();
    fixture.tileFetch.resolveNext(false);
    fixture.boundsSwitch.resolveNext();

    const result = await switchPromise;
    expect(result).toEqual({
      tileFetchSucceeded: false,
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
    fixture.gridUpdate.resolveNext();
    fixture.tileFetch.resolveNext(true);
    fixture.boundsSwitch.resolveNext();

    const result = await switchPromise;
    expect(result).toEqual({
      tileFetchSucceeded: true,
      committedManagers: false,
      rolledBack: false,
      unregisteredPreviousChunk: false,
      committedChunk: "0,0",
    });
    expect(fixture.managerUpdate.calls).toEqual([]);
    expect(fixture.getCurrentChunk()).toBe("0,0");
  });
});
