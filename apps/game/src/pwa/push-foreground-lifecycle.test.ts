import { afterEach, beforeEach, expect, it, vi } from "vitest";
const sync = vi.hoisted(() => vi.fn());
vi.mock("./push-notification-client", () => ({ syncPushGameForeground: sync }));
import { startPushForegroundLifecycle } from "./push-foreground-lifecycle";
let cleanup: (() => void) | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("navigator", { serviceWorker: {} });
  sync.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("refreshes the active owner immediately and at each lease interval", async () => {
  cleanup = startPushForegroundLifecycle("0x1");
  await vi.advanceTimersByTimeAsync(0);
  await vi.waitFor(() => expect(sync.mock.calls.map(([owner]) => [owner])).toEqual([["0x1"]]));
  await vi.advanceTimersByTimeAsync(20_000);
  await vi.waitFor(() => expect(sync.mock.calls.map(([owner]) => [owner])).toEqual([["0x1"], ["0x1"]]));
  cleanup();
  await vi.advanceTimersByTimeAsync(40_000);
  expect(sync).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});

it("coalesces an event burst to one pending refresh without overlapping requests", async () => {
  let finish!: () => void;
  sync.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  cleanup = startPushForegroundLifecycle("0x1");
  await vi.advanceTimersByTimeAsync(0);
  for (let i = 0; i < 10; i++) {
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("urlChanged"));
    document.dispatchEvent(new Event("visibilitychange"));
  }
  await vi.advanceTimersByTimeAsync(20_000);
  expect(sync).toHaveBeenCalledOnce();
  finish();
  await vi.advanceTimersByTimeAsync(0);
  expect(sync).toHaveBeenCalledTimes(2);
});

it("removes listeners and pending work on repeated start and stop", async () => {
  let finish!: () => void;
  sync.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  cleanup = startPushForegroundLifecycle("0x1");
  await vi.advanceTimersByTimeAsync(0);
  window.dispatchEvent(new Event("focus"));
  cleanup();
  expect(sync.mock.calls[0][1].aborted).toBe(true);
  finish();
  document.dispatchEvent(new Event("visibilitychange"));
  window.dispatchEvent(new Event("focus"));
  await vi.advanceTimersByTimeAsync(40_000);
  await vi.waitFor(() => expect(sync.mock.calls.map(([owner]) => [owner])).toEqual([["0x1"]]));
  cleanup = startPushForegroundLifecycle("0x2");
  await vi.advanceTimersByTimeAsync(0);
  window.dispatchEvent(new Event("online"));
  await vi.advanceTimersByTimeAsync(0);
  await vi.waitFor(() => expect(sync.mock.calls.map(([owner]) => [owner])).toEqual([["0x1"], ["0x2"], ["0x2"]]));
});

it("reports a failure streak once, then reports a new failure after recovery", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  sync.mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce(new Error("offline"));
  cleanup = startPushForegroundLifecycle("0x1");
  await vi.waitFor(() => expect(warn).toHaveBeenCalledOnce());
  window.dispatchEvent(new Event("focus"));
  await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(2));
  await vi.advanceTimersByTimeAsync(1);
  expect(warn.mock.calls).toEqual([["push_game_foreground_sync_failed"]]);
  window.dispatchEvent(new Event("focus"));
  await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(3));
  await vi.advanceTimersByTimeAsync(1);
  sync.mockRejectedValueOnce(new Error("offline"));
  window.dispatchEvent(new Event("online"));
  await vi.waitFor(() =>
    expect(warn.mock.calls).toEqual([["push_game_foreground_sync_failed"], ["push_game_foreground_sync_failed"]]),
  );
});
