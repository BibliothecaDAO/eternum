import { describe, expect, it, vi } from "vitest";

import { commitOwnedWorldmapPreparedTerrain } from "./worldmap-owned-terrain-commit";

function createControlledCommitQueue() {
  let runPendingCommit: (() => void) | null = null;

  return {
    scheduleCommit: vi.fn(
      (commit: () => number | null) =>
        new Promise<number | null>((resolve) => {
          runPendingCommit = () => resolve(commit());
        }),
    ),
    runPendingCommit() {
      if (!runPendingCommit) {
        throw new Error("No terrain commit is pending");
      }
      const run = runPendingCommit;
      runPendingCommit = null;
      run();
    },
  };
}

function createTerrainCommitFixture() {
  const queue = createControlledCommitQueue();
  const preparedTerrain = { chunkKey: "24,24" };
  const commitChunkAuthority = vi.fn();
  const applyPreparedTerrain = vi.fn();
  const disposePreparedTerrain = vi.fn();
  let currentTransitionToken = 4;
  let recoveryTransitionToken: number | null = null;
  let switchedOff = false;

  const commit = () =>
    commitOwnedWorldmapPreparedTerrain({
      preparedTerrain,
      targetChunk: "24,24",
      transitionToken: 4,
      getCurrentTransitionToken: () => currentTransitionToken,
      getRecoveryTransitionToken: () => recoveryTransitionToken,
      isSwitchedOff: () => switchedOff,
      scheduleCommit: queue.scheduleCommit,
      disposePreparedTerrain,
      commitChunkAuthority,
      applyPreparedTerrain,
    });

  return {
    applyPreparedTerrain,
    commit,
    commitChunkAuthority,
    disposePreparedTerrain,
    preparedTerrain,
    queue,
    supersede: () => {
      currentTransitionToken += 1;
    },
    recoverTimedOutTransition: () => {
      currentTransitionToken += 1;
      recoveryTransitionToken = currentTransitionToken;
    },
    switchOff: () => {
      switchedOff = true;
    },
  };
}

describe("commitOwnedWorldmapPreparedTerrain", () => {
  it("commits through the immediate timeout-recovery token instead of retrying the same chunk", async () => {
    const fixture = createTerrainCommitFixture();
    const result = fixture.commit();

    fixture.recoverTimedOutTransition();
    fixture.queue.runPendingCommit();

    await expect(result).resolves.toBe(4);
    expect(fixture.disposePreparedTerrain).not.toHaveBeenCalled();
    expect(fixture.commitChunkAuthority).toHaveBeenCalledWith("24,24");
    expect(fixture.applyPreparedTerrain).toHaveBeenCalledWith(fixture.preparedTerrain);
  });

  it("drops prepared terrain when an ordinary successor transition owns the scene", async () => {
    const fixture = createTerrainCommitFixture();
    const result = fixture.commit();

    fixture.supersede();
    fixture.queue.runPendingCommit();

    await expect(result).resolves.toBeNull();
    expect(fixture.disposePreparedTerrain).toHaveBeenCalledWith(fixture.preparedTerrain);
    expect(fixture.commitChunkAuthority).not.toHaveBeenCalled();
    expect(fixture.applyPreparedTerrain).not.toHaveBeenCalled();
  });

  it("drops recovered terrain after authority advances beyond the recorded recovery", async () => {
    const fixture = createTerrainCommitFixture();
    const result = fixture.commit();

    fixture.recoverTimedOutTransition();
    fixture.supersede();
    fixture.queue.runPendingCommit();

    await expect(result).resolves.toBeNull();
    expect(fixture.disposePreparedTerrain).toHaveBeenCalledWith(fixture.preparedTerrain);
    expect(fixture.commitChunkAuthority).not.toHaveBeenCalled();
    expect(fixture.applyPreparedTerrain).not.toHaveBeenCalled();
  });

  it("drops a prepared chunk when the scene switches off while its critical commit is queued", async () => {
    const fixture = createTerrainCommitFixture();
    const result = fixture.commit();

    fixture.switchOff();
    fixture.queue.runPendingCommit();

    await expect(result).resolves.toBeNull();
    expect(fixture.disposePreparedTerrain).toHaveBeenCalledOnce();
    expect(fixture.commitChunkAuthority).not.toHaveBeenCalled();
    expect(fixture.applyPreparedTerrain).not.toHaveBeenCalled();
  });

  it("commits authority and terrain exactly once when the queued owner still wins", async () => {
    const fixture = createTerrainCommitFixture();
    const result = fixture.commit();

    fixture.queue.runPendingCommit();

    await expect(result).resolves.toBe(4);
    expect(fixture.commitChunkAuthority).toHaveBeenCalledOnce();
    expect(fixture.commitChunkAuthority).toHaveBeenCalledWith("24,24");
    expect(fixture.applyPreparedTerrain).toHaveBeenCalledOnce();
    expect(fixture.applyPreparedTerrain).toHaveBeenCalledWith(fixture.preparedTerrain);
    expect(fixture.commitChunkAuthority.mock.invocationCallOrder[0]).toBeLessThan(
      fixture.applyPreparedTerrain.mock.invocationCallOrder[0],
    );
    expect(fixture.disposePreparedTerrain).not.toHaveBeenCalled();
  });
});
