import { describe, expect, it, vi } from "vitest";
import { createCoalescedAsyncUpdateRunner, waitForVisualSettle } from "./manager-update-convergence";

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
    });

    await triggerDuringRun();
    expect(calls.filter((entry) => entry === "drain").length).toBe(2);
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
