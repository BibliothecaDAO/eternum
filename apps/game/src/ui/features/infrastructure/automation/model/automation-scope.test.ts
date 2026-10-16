import { afterEach, expect, it, vi } from "vitest";
import { startAutomationScope } from "./automation-scope";
afterEach(() => vi.useRealTimers());

it("serializes clock and config passes, aborts observation, and releases the subscription", async () => {
  vi.useFakeTimers();
  let changed!: () => void;
  const unsubscribe = vi.fn();
  let signal!: AbortSignal;
  let resolve!: () => void;
  const run = vi.fn((next: AbortSignal) => {
    signal = next;
    return new Promise<void>((done) => {
      resolve = done;
    });
  });
  const stop = startAutomationScope(run, (notify) => {
    changed = notify;
    return unsubscribe;
  });
  await vi.advanceTimersByTimeAsync(1_001);
  expect(run).toHaveBeenCalledTimes(1);
  changed();
  changed();
  await vi.advanceTimersByTimeAsync(2_000);
  expect(run).toHaveBeenCalledTimes(1);
  stop();
  await vi.advanceTimersByTimeAsync(0);
  expect(signal.aborted).toBe(true);
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  resolve();
  await vi.advanceTimersByTimeAsync(10_000);
  expect(run).toHaveBeenCalledTimes(1);
});

it("surfaces a failed pass and continues checking", async () => {
  vi.useFakeTimers();
  const error = new Error("facts missing");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const run = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined);
  const stop = startAutomationScope(run);
  await vi.advanceTimersByTimeAsync(2_001);
  expect(run.mock.calls.length).toBeGreaterThanOrEqual(2);
  expect(log).toHaveBeenCalledWith("Automation pass unavailable", error);
  stop();
  log.mockRestore();
});

it("releases the clock and subscription when the game ends", async () => {
  vi.useFakeTimers();
  const run = vi.fn(async () => false as const);
  const unsubscribe = vi.fn();
  const stop = startAutomationScope(run, () => unsubscribe);
  await vi.advanceTimersByTimeAsync(10_001);
  expect(run).toHaveBeenCalledTimes(1);
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  stop();
});
