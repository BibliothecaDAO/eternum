import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PIPELINE_PREWARM_BUDGET_MS,
  PIPELINE_PREWARM_DISABLED_FOR_P5_MEASUREMENT,
  runTimeboxedPipelinePrewarm,
} from "./pipeline-prewarm-runtime";

describe("runTimeboxedPipelinePrewarm", () => {
  it("pins the explicit P5 cold-entry measurement with prewarm disabled", () => {
    expect(PIPELINE_PREWARM_DISABLED_FOR_P5_MEASUREMENT).toBe(true);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("restores the warmup view and logs a completed prewarm", async () => {
    const events: string[] = [];
    const log = vi.fn();

    const result = await runTimeboxedPipelinePrewarm({
      compile: async () => {
        events.push("compile");
      },
      enterWarmupView: () => {
        events.push("view:close");
        return () => events.push("view:restore");
      },
      log,
      now: vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(145),
      prepare: async () => {
        events.push("prepare");
      },
    });

    expect(result).toBe("completed");
    expect(events).toEqual(["prepare", "view:close", "compile", "view:restore"]);
    expect(log).toHaveBeenCalledWith("[GpuBackendPerf] pipeline prewarm 45ms (completed)");
  });

  it("restores the view at the budget while compilation continues in the background", async () => {
    vi.useFakeTimers();
    const events: string[] = [];
    const log = vi.fn();
    let finishCompile!: () => void;

    const resultPromise = runTimeboxedPipelinePrewarm({
      compile: () =>
        new Promise<void>((resolve) => {
          events.push("compile");
          finishCompile = resolve;
        }),
      enterWarmupView: () => {
        events.push("view:close");
        return () => events.push("view:restore");
      },
      log,
      now: () => Date.now(),
      prepare: async () => {
        events.push("prepare");
      },
    });

    await vi.advanceTimersByTimeAsync(PIPELINE_PREWARM_BUDGET_MS);

    await expect(resultPromise).resolves.toBe("timed out");
    expect(events).toEqual(["prepare", "view:close", "compile", "view:restore"]);
    expect(log).toHaveBeenCalledWith(`[GpuBackendPerf] pipeline prewarm ${PIPELINE_PREWARM_BUDGET_MS}ms (timed out)`);

    finishCompile();
    await Promise.resolve();
    expect(events).toEqual(["prepare", "view:close", "compile", "view:restore"]);
  });

  it("does not change the view when preparation finishes after the budget", async () => {
    vi.useFakeTimers();
    const compile = vi.fn(async () => {});
    const enterWarmupView = vi.fn(() => vi.fn());
    let finishPreparation!: () => void;

    const resultPromise = runTimeboxedPipelinePrewarm({
      compile,
      enterWarmupView,
      log: vi.fn(),
      now: () => Date.now(),
      prepare: () =>
        new Promise<void>((resolve) => {
          finishPreparation = resolve;
        }),
    });

    await vi.advanceTimersByTimeAsync(PIPELINE_PREWARM_BUDGET_MS);
    await expect(resultPromise).resolves.toBe("timed out");

    finishPreparation();
    await Promise.resolve();
    await Promise.resolve();

    expect(enterWarmupView).not.toHaveBeenCalled();
    expect(compile).toHaveBeenCalledOnce();
  });
});
