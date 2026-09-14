import { Effect } from "effect";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ enabled: true, tick: vi.fn(), source: vi.fn() }));
vi.mock("../env", () => ({ serverEnv: {} }));
vi.mock("./config", () => ({
  resolveAutomaticNotificationConfig: () =>
    mocks.enabled ? { chain: "madara", worldAddress: "0x123", url: "https://herald.test" } : null,
}));
vi.mock("./source", () => ({ createNotificationSource: mocks.source }));
vi.mock("../binding", () => ({ ownerOfGameplayAccount: vi.fn(), verifyGameplayBindingChain: vi.fn() }));
vi.mock("./notifier", async () => {
  const { Effect } = await import("effect");
  return { createAutomaticNotifier: () => ({ tick: Effect.suspend(() => mocks.tick()) }) };
});
vi.mock("./outbox", async () => {
  const { Layer } = await import("effect");
  return { NotificationOutbox: { layer: Layer.empty } };
});
vi.mock("../push-subscription-store", async () => {
  const { Layer } = await import("effect");
  return { PushSubscriptionStore: { layer: Layer.empty } };
});
vi.mock("../web-push-sender", async () => {
  const { Layer } = await import("effect");
  return { WebPushSender: { layer: Layer.empty } };
});

let stop: (() => Promise<void>) | undefined;
const healthyTick = { history: { cursor: { block: 10, transaction: 0, event: 0 } }, unavailable: 0 };
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-13T00:00:00Z"));
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.enabled = true;
  mocks.source.mockReset();
  mocks.tick.mockReset().mockImplementation(() => Effect.succeed(healthyTick));
});
afterEach(async () => {
  await stop?.();
  stop = undefined;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("does not create a source or schedule work when disabled", async () => {
  mocks.enabled = false;
  const runtime = await import("./runtime");
  stop = runtime.startAutomaticNotifications();
  await vi.advanceTimersByTimeAsync(6000);
  expect(mocks.source).not.toHaveBeenCalled();
  expect(mocks.tick).not.toHaveBeenCalled();
  expect(runtime.automaticNotificationHealth()).toMatchObject({ enabled: false, healthy: false, lastTickAt: null });
});

it("continues after a failed tick, reports recovery and stops scheduled work on shutdown", async () => {
  mocks.tick.mockImplementationOnce(() => Effect.fail(new Error("database offline")));
  const runtime = await import("./runtime");
  stop = runtime.startAutomaticNotifications();
  await vi.advanceTimersByTimeAsync(0);
  expect(runtime.automaticNotificationHealth()).toMatchObject({
    enabled: true,
    healthy: false,
    lastResult: { event: "automatic_notifications_unavailable" },
  });
  await vi.advanceTimersByTimeAsync(2001);
  expect(mocks.tick).toHaveBeenCalledTimes(2);
  expect(runtime.automaticNotificationHealth()).toMatchObject({ healthy: true, lastResult: healthyTick });
  await stop();
  stop = undefined;
  await vi.advanceTimersByTimeAsync(6000);
  expect(mocks.tick).toHaveBeenCalledTimes(2);
  expect(runtime.automaticNotificationHealth().healthy).toBe(false);
});

it("marks health stale and interrupts an unfinished tick without waiting for completion", async () => {
  const interrupted = vi.fn();
  mocks.tick
    .mockImplementationOnce(() => Effect.succeed(healthyTick))
    .mockImplementation(() => Effect.never.pipe(Effect.onInterrupt(() => Effect.sync(interrupted))));
  const runtime = await import("./runtime");
  stop = runtime.startAutomaticNotifications();
  await vi.advanceTimersByTimeAsync(0);
  expect(runtime.automaticNotificationHealth().healthy).toBe(true);
  await vi.advanceTimersByTimeAsync(2001);
  expect(mocks.tick).toHaveBeenCalledTimes(2);
  vi.setSystemTime(Date.now() + 60001);
  expect(runtime.automaticNotificationHealth().healthy).toBe(false);
  await stop();
  stop = undefined;
  expect(interrupted).toHaveBeenCalledOnce();
  expect(runtime.automaticNotificationHealth().lastResult).toEqual(healthyTick);
});
