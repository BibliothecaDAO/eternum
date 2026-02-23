import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { createWorldmapChunkOrchestrationFixture } from "./worldmap-chunk-orchestration-fixture";
import { flushMicrotasks } from "./worldmap-test-harness";
import { invalidateWorldmapSwitchOffTransitionState } from "./worldmap-runtime-lifecycle";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const worldmapPath = resolve(currentDir, "worldmap.tsx");
  return readFileSync(worldmapPath, "utf8");
}

describe("worldmap switch-off transition race hardening", () => {
  it("invalidates transition ownership state on switch-off", () => {
    const inFlightSwitchPromise = Promise.resolve();

    const state = invalidateWorldmapSwitchOffTransitionState({
      chunkTransitionToken: 9,
      isChunkTransitioning: true,
      globalChunkSwitchPromise: inFlightSwitchPromise,
    });

    expect(state).toEqual({
      chunkTransitionToken: 10,
      isChunkTransitioning: false,
      globalChunkSwitchPromise: null,
    });
  });

  it("suppresses stale manager commits after switch-off token invalidation", async () => {
    const fixture = createWorldmapChunkOrchestrationFixture();
    const capturedTransitionToken = 22;

    const switchOffState = invalidateWorldmapSwitchOffTransitionState({
      chunkTransitionToken: capturedTransitionToken,
      isChunkTransitioning: true,
      globalChunkSwitchPromise: Promise.resolve(),
    });

    const switchPromise = fixture.runChunkSwitch({
      chunkKey: "24,24",
      startRow: 24,
      startCol: 24,
      force: false,
      transitionToken: capturedTransitionToken,
      isCurrentTransition: capturedTransitionToken === switchOffState.chunkTransitionToken,
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

  it("wires switch-off transition invalidation into worldmap scene", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(/invalidateWorldmapSwitchOffTransitionState/);
  });
});
