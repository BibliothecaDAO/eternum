import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { workerRequest } from "./worker-request";
import { notificationWorkerRequest } from "./local-notification-client";

class Port {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onmessageerror: ((event: unknown) => void) | null = null;
  close = vi.fn();
}
let channels: Array<{ port1: Port; port2: Port }>;
beforeEach(() => {
  channels = [];
  vi.stubGlobal(
    "MessageChannel",
    class {
      port1 = new Port();
      port2 = new Port();
      constructor() {
        channels.push(this);
      }
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const request = (postMessage = vi.fn()) =>
  workerRequest({ postMessage }, { type: "RELEASE" }, Schema.NullOr(Schema.String), 3000, "release timed out");
function closed() {
  expect(channels).toHaveLength(1);
  expect(channels[0].port1.close).toHaveBeenCalledOnce();
  expect(channels[0].port2.close).toHaveBeenCalledOnce();
  expect(channels[0].port1.onmessage).toBeNull();
  expect(channels[0].port1.onmessageerror).toBeNull();
}
it.each(["release-b", null])("closes both ports after a valid reply %s", async (data) => {
  const task = Effect.runPromise(request());
  channels[0].port1.onmessage!({ data });
  expect(await task).toBe(data);
  closed();
});
it("rejects malformed replies instead of treating them as legacy", async () => {
  const task = Effect.runPromise(request());
  channels[0].port1.onmessage!({ data: { release: "b" } });
  await expect(task).rejects.toMatchObject({ _tag: "WorkerRequestError", reason: "reply" });
  closed();
});
it("closes both ports on a synchronous send failure", async () => {
  await expect(
    Effect.runPromise(
      request(
        vi.fn(() => {
          throw new Error("transfer failed");
        }),
      ),
    ),
  ).rejects.toMatchObject({ reason: "transport" });
  closed();
});
it("closes both ports on a deserialization failure", async () => {
  const task = Effect.runPromise(request());
  channels[0].port1.onmessageerror!(new Event("messageerror"));
  await expect(task).rejects.toMatchObject({ reason: "transport" });
  closed();
});
it("interrupts a timed-out request and removes its clock and ports", async () => {
  vi.useFakeTimers();
  const task = Effect.runPromise(request());
  const result = expect(task).rejects.toMatchObject({ reason: "timeout", message: "release timed out" });
  await vi.advanceTimersByTimeAsync(3000);
  await result;
  closed();
  expect(vi.getTimerCount()).toBe(0);
});
it("caller cancellation closes ports and prevents a late reply", async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const task = Effect.runPromise(request(), { signal: controller.signal });
  const result = expect(task).rejects.toThrow();
  controller.abort();
  await result;
  closed();
  expect(vi.getTimerCount()).toBe(0);
});
it("clears its timeout on success", async () => {
  vi.useFakeTimers();
  const task = Effect.runPromise(request());
  channels[0].port1.onmessage!({ data: "release-b" });
  await task;
  closed();
  expect(vi.getTimerCount()).toBe(0);
});
it.each([
  [
    "enable",
    { ok: true, value: { owner: "0x1", token: "t", enabledAt: 100 } },
    { owner: "0x1", token: "t", enabledAt: 100 },
  ],
  ["game-foreground-status", { ok: true, value: false }, false],
  ["status", { ok: true, value: null }, null],
] as const)("decodes the actual notification %s response", async (action, data, expected) => {
  vi.stubGlobal("navigator", {
    serviceWorker: { getRegistration: async () => ({ active: { postMessage: vi.fn() } }) },
  });
  const task = notificationWorkerRequest("0x1", action);
  await vi.waitFor(() => expect(channels).toHaveLength(1));
  channels[0].port1.onmessage!({ data });
  expect(await task).toEqual(expected);
  closed();
});
it.each([
  [{ ok: true, value: "yes" }, "reply"],
  [{ ok: "yes", value: true }, "reply"],
  [{ ok: false, error: "Account changed" }, "rejected"],
])("rejects invalid or refused notification replies", async (data, reason) => {
  vi.stubGlobal("navigator", {
    serviceWorker: { getRegistration: async () => ({ active: { postMessage: vi.fn() } }) },
  });
  const task = notificationWorkerRequest("0x1", "game-foreground-status");
  const rejected = expect(task).rejects.toMatchObject({ reason });
  await vi.waitFor(() => expect(channels).toHaveLength(1));
  channels[0].port1.onmessage!({ data });
  await rejected;
  closed();
});

it("cancels before registration resolves without creating a channel afterward", async () => {
  let registered!: (registration: { active: { postMessage: ReturnType<typeof vi.fn> } }) => void;
  vi.stubGlobal("navigator", {
    serviceWorker: {
      getRegistration: () =>
        new Promise((resolve) => {
          registered = resolve;
        }),
    },
  });
  const controller = new AbortController();
  const task = notificationWorkerRequest("0x1", "status", {}, controller.signal);
  const rejected = expect(task).rejects.toThrow();
  controller.abort();
  await rejected;
  const postMessage = vi.fn();
  registered({ active: { postMessage } });
  await Promise.resolve();
  expect(channels).toHaveLength(0);
  expect(postMessage).not.toHaveBeenCalled();
});
