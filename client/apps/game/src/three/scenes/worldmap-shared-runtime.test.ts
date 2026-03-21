import { describe, expect, it } from "vitest";

import { createWorldmapSharedRuntimeFixture } from "./worldmap-shared-runtime-fixture";

describe("worldmap shared runtime baseline", () => {
  it("runs the same shared label-group and manager-label lifecycle on setup and resume", async () => {
    const fixture = createWorldmapSharedRuntimeFixture();

    await fixture.setup();
    const setupLifecycle = fixture.snapshotAttachLifecycle();

    fixture.switchOff();

    await fixture.resume();
    const resumeLifecycle = fixture.snapshotAttachLifecycle({ sinceLastSnapshot: true });

    expect(resumeLifecycle).toEqual(setupLifecycle);
  });

  it("detaches shared label groups and manager labels symmetrically on switch-off", async () => {
    const fixture = createWorldmapSharedRuntimeFixture();

    await fixture.setup();
    fixture.switchOff();

    expect(fixture.snapshotDetachLifecycle()).toEqual([
      "scene:remove:ArmyLabelsGroup",
      "scene:remove:StructureLabelsGroup",
      "scene:remove:ChestLabelsGroup",
      "army:removeLabelsFromScene",
      "structure:removeLabelsFromScene",
      "chest:removeLabelsFromScene",
    ]);
  });

  it("no-ops the shared refresh entry point when switched off", async () => {
    const fixture = createWorldmapSharedRuntimeFixture({
      currentChunk: "24,24",
    });

    fixture.switchOff();
    const result = await fixture.refreshCurrentChunk(true);

    expect(result).toBe(false);
    expect(fixture.getCurrentChunk()).toBe("24,24");
    expect(fixture.getManagerUpdateCalls()).toEqual([]);
  });

  it("fans out chunk switch updates to all registered managers with the same transition token", async () => {
    const fixture = createWorldmapSharedRuntimeFixture({
      currentChunk: "0,0",
    });

    const result = await fixture.switchToChunk("24,24");

    expect(result).toEqual({
      changedChunk: true,
      transitionToken: 1,
    });
    expect(fixture.getCurrentChunk()).toBe("24,24");
    expect(fixture.getManagerUpdateCalls()).toEqual([
      { manager: "army", chunkKey: "24,24", options: { force: false, transitionToken: 1 } },
      { manager: "structure", chunkKey: "24,24", options: { force: false, transitionToken: 1 } },
      { manager: "chest", chunkKey: "24,24", options: { force: false, transitionToken: 1 } },
    ]);
  });

  it("preserves chunk identity during forced refresh fanout", async () => {
    const fixture = createWorldmapSharedRuntimeFixture({
      currentChunk: "24,24",
    });

    const result = await fixture.refreshCurrentChunk(true);

    expect(result).toBe(true);
    expect(fixture.getCurrentChunk()).toBe("24,24");
    expect(fixture.getManagerUpdateCalls()).toEqual([
      { manager: "army", chunkKey: "24,24", options: { force: true, transitionToken: 1 } },
      { manager: "structure", chunkKey: "24,24", options: { force: true, transitionToken: 1 } },
      { manager: "chest", chunkKey: "24,24", options: { force: true, transitionToken: 1 } },
    ]);
  });
});
