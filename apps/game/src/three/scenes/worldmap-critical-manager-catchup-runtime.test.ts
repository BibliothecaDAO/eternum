import { describe, expect, it, vi } from "vitest";

import {
  handleWorldmapCriticalManagerCatchUpFailures,
  runWorldmapCriticalManagerCatchUp,
} from "./worldmap-critical-manager-catchup-runtime";

describe("handleWorldmapCriticalManagerCatchUpFailures", () => {
  it("records each critical failure and schedules one recovery refresh", () => {
    const onManagerFailure = vi.fn();
    const scheduleRecovery = vi.fn();

    const failureCount = handleWorldmapCriticalManagerCatchUpFailures({
      chunkKey: "24,24",
      failures: [
        { label: "army", reason: new Error("army failed") },
        { label: "structure", reason: new Error("structure failed") },
      ],
      onManagerFailure,
      scheduleRecovery,
    });

    expect(failureCount).toBe(2);
    expect(onManagerFailure).toHaveBeenCalledTimes(2);
    expect(scheduleRecovery).toHaveBeenCalledTimes(1);
    expect(scheduleRecovery).toHaveBeenCalledWith("24,24", ["army", "structure"]);
  });

  it("does nothing when all critical managers succeed", () => {
    const onManagerFailure = vi.fn();
    const scheduleRecovery = vi.fn();

    const failureCount = handleWorldmapCriticalManagerCatchUpFailures({
      chunkKey: "24,24",
      failures: [],
      onManagerFailure,
      scheduleRecovery,
    });

    expect(failureCount).toBe(0);
    expect(onManagerFailure).not.toHaveBeenCalled();
    expect(scheduleRecovery).not.toHaveBeenCalled();
  });

  it("times out stalled critical manager work and recovers only the failed manager", async () => {
    vi.useFakeTimers();
    try {
      const recoverArmy = vi.fn();
      const recoverStructure = vi.fn();

      const catchUpPromise = runWorldmapCriticalManagerCatchUp({
        context: { chunkKey: "24,24", transitionToken: 1, triggerReason: "test" },
        timeoutMs: 25,
        managers: [
          {
            label: "army",
            run: () => new Promise<void>(() => undefined),
            recover: recoverArmy,
          },
          {
            label: "structure",
            run: async () => undefined,
            recover: recoverStructure,
          },
        ],
      });

      await vi.advanceTimersByTimeAsync(25);

      await expect(catchUpPromise).resolves.toHaveLength(1);
      expect(recoverArmy).toHaveBeenCalledTimes(1);
      expect(recoverStructure).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("treats zero timeout as unbounded critical manager work", async () => {
    const recoverArmy = vi.fn();
    const setTimeoutFn = vi.fn((callback: () => void, timeoutMs: number) => setTimeout(callback, timeoutMs));
    const clearTimeoutFn = vi.fn((handle: ReturnType<typeof setTimeout>) => clearTimeout(handle));

    const failures = await runWorldmapCriticalManagerCatchUp({
      context: { chunkKey: "24,24", transitionToken: 1, triggerReason: "test" },
      timeoutMs: 0,
      setTimeoutFn,
      clearTimeoutFn,
      managers: [
        {
          label: "army",
          run: async () => undefined,
          recover: recoverArmy,
        },
      ],
    });

    expect(failures).toEqual([]);
    expect(recoverArmy).not.toHaveBeenCalled();
    expect(setTimeoutFn).not.toHaveBeenCalled();
    expect(clearTimeoutFn).not.toHaveBeenCalled();
  });

  it("labels slow sliced catch-up as convergence latency rather than blocking time", async () => {
    const log = vi.fn();
    const timestamps = [0, 181];

    await runWorldmapCriticalManagerCatchUp({
      context: { chunkKey: "24,24", transitionToken: 7, triggerReason: "initial_setup" },
      timeoutMs: 0,
      now: () => timestamps.shift() ?? 181,
      log,
      managers: [
        {
          label: "structure",
          run: async () => undefined,
          recover: vi.fn(),
        },
      ],
    });

    expect(log).toHaveBeenCalledWith(
      "[WorldmapPerf] critical structure manager catch-up chunk=24,24 transition=7 trigger=initial_setup converged after 181ms of sliced wall time",
    );
  });

  it("labels a timed-out catch-up honestly", async () => {
    vi.useFakeTimers();
    try {
      const log = vi.fn();
      const timestamps = [0, 25];
      const catchUpPromise = runWorldmapCriticalManagerCatchUp({
        context: { chunkKey: "24,24", transitionToken: 7, triggerReason: "initial_setup" },
        timeoutMs: 25,
        now: () => timestamps.shift() ?? 25,
        log,
        managers: [
          {
            label: "structure",
            run: () => new Promise<void>(() => undefined),
            recover: vi.fn(),
          },
        ],
      });

      await vi.advanceTimersByTimeAsync(25);
      await catchUpPromise;

      expect(log).toHaveBeenCalledWith(
        "[WorldmapPerf] critical structure manager catch-up chunk=24,24 transition=7 trigger=initial_setup timed_out after 25ms of sliced wall time",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("stays silent when no console reporter is injected", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const timestamps = [0, 181];

    try {
      await runWorldmapCriticalManagerCatchUp({
        context: { chunkKey: "24,24", transitionToken: 7, triggerReason: "initial_setup" },
        timeoutMs: 0,
        now: () => timestamps.shift() ?? 181,
        managers: [
          {
            label: "structure",
            run: async () => undefined,
            recover: vi.fn(),
          },
        ],
      });

      expect(info).not.toHaveBeenCalled();
    } finally {
      info.mockRestore();
    }
  });

  it("recovers rejected critical manager work without blocking successful managers", async () => {
    const recoverArmy = vi.fn();
    const recoverStructure = vi.fn();

    const failures = await runWorldmapCriticalManagerCatchUp({
      context: { chunkKey: "24,24", transitionToken: 1, triggerReason: "test" },
      timeoutMs: 25,
      managers: [
        {
          label: "army",
          run: async () => {
            throw new Error("army failed");
          },
          recover: recoverArmy,
        },
        {
          label: "structure",
          run: async () => undefined,
          recover: recoverStructure,
        },
      ],
    });

    expect(failures).toEqual([{ label: "army", reason: expect.any(Error) }]);
    expect(recoverArmy).toHaveBeenCalledTimes(1);
    expect(recoverStructure).not.toHaveBeenCalled();
  });

  it("waits for the bounded critical batch before invalidating failed managers", async () => {
    const recoverArmy = vi.fn();
    const recoverStructure = vi.fn();
    let resolveStructure!: () => void;

    const catchUpPromise = runWorldmapCriticalManagerCatchUp({
      context: { chunkKey: "24,24", transitionToken: 1, triggerReason: "test" },
      timeoutMs: 25,
      managers: [
        {
          label: "army",
          run: async () => {
            throw new Error("army failed");
          },
          recover: recoverArmy,
        },
        {
          label: "structure",
          run: () =>
            new Promise<void>((resolve) => {
              resolveStructure = resolve;
            }),
          recover: recoverStructure,
        },
      ],
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(recoverArmy).not.toHaveBeenCalled();

    resolveStructure();

    await expect(catchUpPromise).resolves.toEqual([{ label: "army", reason: expect.any(Error) }]);
    expect(recoverArmy).toHaveBeenCalledTimes(1);
    expect(recoverStructure).not.toHaveBeenCalled();
  });
});
