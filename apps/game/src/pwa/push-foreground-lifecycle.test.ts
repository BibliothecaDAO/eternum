import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sync: vi.fn() }));
vi.mock("./push-notification-client", () => ({ syncPushGameForeground: mocks.sync }));
import { startPushForegroundLifecycle } from "./push-foreground-lifecycle";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("navigator", { serviceWorker: {} });
  mocks.sync.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("refreshes foreground presence immediately, on lifecycle changes, and before the lease expires", async () => {
  const stop = startPushForegroundLifecycle("0x1");
  await vi.waitFor(() => expect(mocks.sync).toHaveBeenCalledTimes(1));

  document.dispatchEvent(new Event("visibilitychange"));
  await vi.waitFor(() => expect(mocks.sync).toHaveBeenCalledTimes(2));
  await vi.advanceTimersByTimeAsync(20_000);
  expect(mocks.sync).toHaveBeenCalledTimes(3);

  stop();
  window.dispatchEvent(new Event("focus"));
  await vi.advanceTimersByTimeAsync(20_000);
  expect(mocks.sync).toHaveBeenCalledTimes(3);
});

it("does nothing where service workers are unavailable", () => {
  vi.stubGlobal("navigator", {});
  startPushForegroundLifecycle("0x1")();
  expect(mocks.sync).not.toHaveBeenCalled();
});
