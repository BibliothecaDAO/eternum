import { describe, expect, it, vi } from "vitest";
import {
  FrameBudgetWorkQueue,
  FrameBudgetWorkQueueDisposedError,
  scheduleFrameBudgetWork,
} from "./frame-budget-work-queue";
import { consumeDominantFrameWorkOwner, runWithFrameWorkOwner } from "./frame-work-owner";

function createHarness(
  options: { isLoading?: () => boolean; onLongTask?: (task: { durationMs: number; owner: string }) => void } = {},
) {
  let now = 0;
  let nextFrameId = 1;
  const frames = new Map<number, FrameRequestCallback>();
  const queue = new FrameBudgetWorkQueue({
    isLoading: options.isLoading,
    onLongTask: options.onLongTask,
    now: () => now,
    requestFrame: (callback) => {
      const id = nextFrameId++;
      frames.set(id, callback);
      return id;
    },
    cancelFrame: (id) => frames.delete(id),
  });

  return {
    advance: (durationMs: number) => {
      now += durationMs;
    },
    flushFrame: async () => {
      const pending = [...frames.entries()];
      frames.clear();
      pending.forEach(([, callback]) => callback(now));
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    },
    frameCount: () => frames.size,
    queue,
  };
}

describe("FrameBudgetWorkQueue", () => {
  it("uses immediate execution when a manager has no worldmap scheduler", async () => {
    await expect(scheduleFrameBudgetWork(undefined, "visible", () => 7)).resolves.toBe(7);
    await expect(
      scheduleFrameBudgetWork(undefined, "visible", () => {
        throw new Error("immediate failure");
      }),
    ).rejects.toThrow("immediate failure");
  });

  it("runs critical work before visible and prefetch work", async () => {
    const harness = createHarness();
    const calls: string[] = [];
    const prefetch = harness.queue.schedule("prefetch", () => calls.push("prefetch"));
    const visible = harness.queue.schedule("visible", () => calls.push("visible"));
    const critical = harness.queue.schedule("critical", () => calls.push("critical"));

    await harness.flushFrame();
    await Promise.all([prefetch, visible, critical]);

    expect(calls).toEqual(["critical", "visible", "prefetch"]);
  });

  it("moves remaining work to the next frame after the play budget", async () => {
    const harness = createHarness();
    const calls: number[] = [];
    const tasks = [1, 2, 3].map((value) =>
      harness.queue.schedule("visible", () => {
        calls.push(value);
        harness.advance(3);
      }),
    );

    await harness.flushFrame();
    expect(calls).toEqual([1, 2]);
    expect(harness.frameCount()).toBe(1);

    await harness.flushFrame();
    await Promise.all(tasks);
    expect(calls).toEqual([1, 2, 3]);
  });

  it("uses the raised loading-gate budget", async () => {
    const harness = createHarness({ isLoading: () => true });
    const calls: number[] = [];
    const tasks = Array.from({ length: 5 }, (_, index) =>
      harness.queue.schedule("critical", () => {
        calls.push(index);
        harness.advance(5);
      }),
    );

    await harness.flushFrame();
    await Promise.all(tasks);

    expect(calls).toHaveLength(5);
    expect(harness.frameCount()).toBe(0);
  });

  it("bounds lower-lane starvation under continuous critical work", async () => {
    const harness = createHarness();
    const calls: string[] = [];
    const tasks = Array.from({ length: 10 }, (_, index) =>
      harness.queue.schedule("critical", () => calls.push(`critical-${index}`)),
    );
    tasks.push(harness.queue.schedule("visible", () => calls.push("visible")));

    await harness.flushFrame();
    await Promise.all(tasks);

    expect(calls.indexOf("visible")).toBe(8);
  });

  it("runs a continuation scheduled by the active work unit", async () => {
    const harness = createHarness();
    const calls: string[] = [];
    let continuation: Promise<number> | undefined;
    const initial = harness.queue.schedule("critical", () => {
      calls.push("initial");
      continuation = harness.queue.schedule("critical", () => {
        calls.push("continuation");
        return 2;
      });
      return 1;
    });

    await harness.flushFrame();

    await expect(initial).resolves.toBe(1);
    await expect(continuation!).resolves.toBe(2);
    expect(calls).toEqual(["initial", "continuation"]);
  });

  it("preserves the scheduling owner when the queued unit runs", async () => {
    const harness = createHarness();
    const pending = runWithFrameWorkOwner("catchup:army", () => harness.queue.schedule("visible", () => undefined));

    // Discard the scheduling call itself; the queued execution must restore
    // the captured owner on the following frame.
    consumeDominantFrameWorkOwner();
    await harness.flushFrame();
    await pending;

    expect(consumeDominantFrameWorkOwner()).toBe("catchup:army");
  });

  it("uses an explicit domain owner instead of the generic lane", async () => {
    const harness = createHarness();
    const pending = harness.queue.schedule("visible", () => undefined, "terrain:visible-page-build");

    await harness.flushFrame();
    await pending;

    expect(consumeDominantFrameWorkOwner()).toBe("terrain:visible-page-build");
  });

  it("reports long work through the bounded diagnostic callback without writing to the console", async () => {
    const onLongTask = vi.fn();
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const harness = createHarness({ onLongTask });
    const pending = harness.queue.schedule(
      "critical",
      () => {
        harness.advance(40);
      },
      "terrain:critical-page-build",
    );

    await harness.flushFrame();
    await pending;

    expect(onLongTask).toHaveBeenCalledWith({ durationMs: 40, owner: "terrain:critical-page-build" });
    expect(consoleWarn).not.toHaveBeenCalled();
    consoleWarn.mockRestore();
  });

  it("rejects queued work when disposed", async () => {
    const harness = createHarness();
    const pending = harness.queue.schedule("visible", () => undefined);

    harness.queue.dispose();

    await expect(pending).rejects.toBeInstanceOf(FrameBudgetWorkQueueDisposedError);
    expect(harness.frameCount()).toBe(0);
  });
});
