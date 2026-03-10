import { afterEach, describe, expect, it, vi } from "vitest";
import { LightningScheduler } from "./lightning-scheduler";

describe("LightningScheduler", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("cancels a scheduled lightning start", () => {
    vi.useFakeTimers();
    const scheduler = new LightningScheduler();
    const onStart = vi.fn();

    scheduler.scheduleStart(onStart, 2000);
    scheduler.clear();
    vi.advanceTimersByTime(2000);

    expect(onStart).not.toHaveBeenCalled();
  });

  it("cancels a scheduled strike timer", () => {
    vi.useFakeTimers();
    const scheduler = new LightningScheduler();
    const onStrike = vi.fn();

    scheduler.scheduleStrike(onStrike, 500);
    scheduler.clear();
    vi.advanceTimersByTime(500);

    expect(onStrike).not.toHaveBeenCalled();
  });
});
