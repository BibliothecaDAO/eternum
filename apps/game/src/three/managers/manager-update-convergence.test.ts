import { describe, expect, it, vi } from "vitest";
import {
  MANAGER_UNCOMMITTED_CHUNK,
  createAsyncPassFence,
  createCoalescedAsyncUpdateRunner,
  isCommittedManagerChunk,
  shouldAcceptManagerChunkRequest,
  shouldRunManagerChunkUpdate,
  waitForVisualSettle,
} from "./manager-update-convergence";

describe("createCoalescedAsyncUpdateRunner", () => {
  it("coalesces concurrent requests into one active runner and drains pending work", async () => {
    const calls: string[] = [];
    let firstRun = true;
    const runner = createCoalescedAsyncUpdateRunner(async () => {
      calls.push("run");
      if (firstRun) {
        firstRun = false;
        await Promise.resolve();
      }
      return true;
    });

    const [a, b] = await Promise.all([runner(), runner()]);
    expect(a).toBeUndefined();
    expect(b).toBeUndefined();
    expect(calls).toEqual(["run", "run"]);

    const triggerDuringRun = createCoalescedAsyncUpdateRunner(async () => {
      calls.push("drain");
      if (calls.filter((entry) => entry === "drain").length === 1) {
        void triggerDuringRun();
        await Promise.resolve();
      }
      return true;
    });

    await triggerDuringRun();
    expect(calls.filter((entry) => entry === "drain").length).toBe(2);
  });

  it("resolves a committed caller without waiting for a sustained burst to drain", async () => {
    const releases: Array<() => void> = [];
    let pass = 0;
    const runner = createCoalescedAsyncUpdateRunner(async () => {
      pass += 1;
      await new Promise<void>((resolve) => releases.push(resolve));
      return true;
    });

    const firstRequest = runner();
    await vi.waitFor(() => expect(releases).toHaveLength(1));
    const burstRequests = Array.from({ length: 100 }, () => runner());
    releases.shift()?.();

    await expect(firstRequest).resolves.toBeUndefined();
    await vi.waitFor(() => expect(releases).toHaveLength(1));
    expect(pass).toBe(2);

    releases.shift()?.();
    await Promise.all(burstRequests);

    expect(pass).toBe(2);
  });

  it("preserves an uncommitted request until a later request retries it", async () => {
    const task = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const runner = createCoalescedAsyncUpdateRunner(task);

    let firstSettled = false;
    const firstRequest = runner().then(() => {
      firstSettled = true;
    });
    await vi.waitFor(() => expect(task).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(firstSettled).toBe(false);

    const retryRequest = runner();
    await Promise.all([firstRequest, retryRequest]);

    expect(task).toHaveBeenCalledTimes(2);
  });

  it("continues with requests that arrive while an earlier pass is failing", async () => {
    let rejectFirstPass!: (reason: unknown) => void;
    const task = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<boolean>((_resolve, reject) => {
            rejectFirstPass = reject;
          }),
      )
      .mockResolvedValueOnce(true);
    const runner = createCoalescedAsyncUpdateRunner(task);

    const firstRequest = runner();
    await vi.waitFor(() => expect(rejectFirstPass).toBeTypeOf("function"));
    const nextRequest = runner();
    rejectFirstPass(new Error("first pass failed"));

    await expect(firstRequest).rejects.toThrow("first pass failed");
    await expect(nextRequest).resolves.toBeUndefined();
    expect(task).toHaveBeenCalledTimes(2);
  });
});

describe("createAsyncPassFence", () => {
  it("keeps a captured snapshot current until the fence is invalidated", () => {
    const fence = createAsyncPassFence();
    const snapshot = fence.capture();

    expect(fence.isCurrent(snapshot)).toBe(true);

    fence.invalidate();

    expect(fence.isCurrent(snapshot)).toBe(false);
  });

  it("supersedes earlier snapshots when the fence is invalidated multiple times", () => {
    const fence = createAsyncPassFence();
    const initialSnapshot = fence.capture();

    fence.invalidate();
    const refreshedSnapshot = fence.capture();
    fence.invalidate();

    expect(fence.isCurrent(initialSnapshot)).toBe(false);
    expect(fence.isCurrent(refreshedSnapshot)).toBe(false);
    expect(fence.isCurrent(fence.capture())).toBe(true);
  });
});

describe("waitForVisualSettle", () => {
  it("resolves on the next animation frame when scheduler is provided", async () => {
    const raf = vi.fn<(callback: FrameRequestCallback) => number>((callback) => {
      callback(16);
      return 1;
    });

    await waitForVisualSettle((callback) => raf(callback));
    expect(raf).toHaveBeenCalledTimes(1);
  });

  it("falls back to timeout scheduling when animation frame scheduler is unavailable", async () => {
    const setTimeoutScheduler = vi.fn<(callback: () => void) => number>((callback) => {
      callback();
      return 1;
    });

    await waitForVisualSettle(null, setTimeoutScheduler);
    expect(setTimeoutScheduler).toHaveBeenCalledTimes(1);
  });
});

describe("isCommittedManagerChunk", () => {
  it("treats the shared startup authority sentinel as uncommitted", () => {
    expect(isCommittedManagerChunk(MANAGER_UNCOMMITTED_CHUNK)).toBe(false);
  });

  it("accepts numeric row/col chunk keys as committed", () => {
    expect(isCommittedManagerChunk("24,24")).toBe(true);
  });

  it("rejects malformed chunk keys", () => {
    expect(isCommittedManagerChunk("bad-key")).toBe(false);
  });
});

describe("shouldAcceptManagerChunkRequest", () => {
  it("accepts non-transition updates without a token", () => {
    expect(
      shouldAcceptManagerChunkRequest({
        chunkKey: "24,24",
        latestTransitionToken: 9,
      }),
    ).toBe(true);
  });

  it("rejects stale transition tokens", () => {
    expect(
      shouldAcceptManagerChunkRequest({
        chunkKey: "24,24",
        transitionToken: 8,
        latestTransitionToken: 9,
      }),
    ).toBe(false);
  });

  it("rejects requests when a token was already bound to another target chunk", () => {
    expect(
      shouldAcceptManagerChunkRequest({
        chunkKey: "48,48",
        transitionToken: 11,
        latestTransitionToken: 11,
        knownChunkForToken: "24,24",
      }),
    ).toBe(false);
  });

  it("accepts requests when token and target chunk remain consistent", () => {
    expect(
      shouldAcceptManagerChunkRequest({
        chunkKey: "24,24",
        transitionToken: 11,
        latestTransitionToken: 11,
        knownChunkForToken: "24,24",
      }),
    ).toBe(true);
  });
});

describe("shouldRunManagerChunkUpdate", () => {
  it("rejects work when transition token is stale", () => {
    expect(
      shouldRunManagerChunkUpdate({
        chunkKey: "24,24",
        currentChunk: "24,24",
        transitionToken: 11,
        latestTransitionToken: 12,
      }),
    ).toBe(false);
  });

  it("rejects work when the manager target diverges from current chunk", () => {
    expect(
      shouldRunManagerChunkUpdate({
        chunkKey: "24,24",
        currentChunk: "48,48",
        transitionToken: 12,
        latestTransitionToken: 12,
      }),
    ).toBe(false);
  });

  it("accepts work only when token and target chunk both match", () => {
    expect(
      shouldRunManagerChunkUpdate({
        chunkKey: "24,24",
        currentChunk: "24,24",
        transitionToken: 12,
        latestTransitionToken: 12,
      }),
    ).toBe(true);
  });
});
