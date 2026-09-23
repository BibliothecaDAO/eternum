// @vitest-environment node
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { beforeEach, afterEach, expect, it, vi } from "vitest";

let installNotificationWorker: typeof import("./notification-worker").installNotificationWorker;
beforeEach(async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("IDBKeyRange", IDBKeyRange);
  vi.resetModules();
  ({ installNotificationWorker } = await import("./notification-worker"));
});
afterEach(() => vi.unstubAllGlobals());

const now = Date.now();
const payload = {
  version: 1,
  id: "story:1",
  owner: "0x1",
  title: "Battle",
  body: "A battle was confirmed",
  target: "/enter/0xa1/1",
  createdAt: now,
  expiresAt: now + 120_000,
};
function harness() {
  const handlers = new Map<string, (event: any) => void>();
  const client = {
    id: "page",
    url: "https://game.test/play/0xa1/1/map",
    focused: false,
    visibilityState: "hidden",
    focus: vi.fn(),
    navigate: vi.fn(),
  };
  const registration = {
    showNotification: vi.fn(),
    getNotifications: vi.fn().mockResolvedValue([]),
    pushManager: { getSubscription: vi.fn().mockResolvedValue(null) },
  };
  const clients = {
    get: vi.fn().mockResolvedValue(client),
    matchAll: vi.fn().mockResolvedValue([client]),
    openWindow: vi.fn(),
  };
  installNotificationWorker({
    addEventListener: (name: string, fn: any) => handlers.set(name, fn),
    registration,
    clients,
    location: { origin: "https://game.test" },
  } as any);
  const send = async (action = "deliver", override: Record<string, unknown> = {}) => {
    const reply = vi.fn();
    let work: Promise<void> | undefined;
    handlers.get("message")!({
      data: { type: "GAME_NOTIFICATION", owner: "0x1", action, token: "token", payload, ...override },
      source: { id: "page" },
      ports: [{ postMessage: reply }],
      waitUntil: (promise: Promise<void>) => {
        work = promise;
      },
    });
    await work;
    return reply.mock.calls[0]?.[0];
  };
  const click = async (data: unknown) => {
    let work: Promise<void> | undefined;
    const close = vi.fn();
    handlers.get("notificationclick")!({
      notification: { data, close },
      waitUntil: (promise: Promise<void>) => {
        work = promise;
      },
    });
    await work;
    expect(close).toHaveBeenCalledOnce();
  };
  const push = async (value: unknown) => {
    let work: Promise<void> | undefined;
    handlers.get("push")!({
      data: { text: () => JSON.stringify(value) },
      waitUntil: (promise: Promise<void>) => {
        work = promise;
      },
    });
    await work;
  };
  return { client, clients, registration, send, click, push };
}
it("delivers once across worker restarts, respects foreground activity and stops revoked push", async () => {
  const h = harness();
  const enabled = await h.send("enable");
  expect(enabled.ok).toBe(true);
  const token = enabled.value.token;
  const local = { ...payload, createdAt: Date.now() };
  const replies = await Promise.all([
    h.send("deliver", { token, payload: local }),
    h.send("deliver", { token, payload: local }),
  ]);
  expect(replies.map((reply) => reply.value)).toEqual(["shown", "suppressed"]);
  expect(h.registration.showNotification).toHaveBeenCalledOnce();

  h.client.visibilityState = "visible";
  const visible = { ...local, id: "visible" };
  expect((await h.send("deliver", { token, payload: visible })).value).toBe("foreground");
  h.client.visibilityState = "hidden";
  expect((await h.send("deliver", { token, payload: visible })).value).toBe("suppressed");
  expect(h.registration.showNotification).toHaveBeenCalledOnce();

  const restarted = harness();
  expect((await restarted.send("deliver", { token, payload: local })).value).toBe("suppressed");
  expect((await restarted.send("deliver", { token, payload: { ...local, owner: "0x2" } })).ok).toBe(false);
  expect((await restarted.send("deliver", { token, payload: { ...local, target: "https://other.test" } })).ok).toBe(
    false,
  );
  expect(restarted.registration.showNotification).not.toHaveBeenCalled();

  const prepared = await restarted.send("prepare-push");
  expect(prepared.ok).toBe(true);
  const id = prepared.value.id;
  expect((await restarted.send("activate-push", { id })).ok).toBe(true);
  const notification = {
    ...local,
    createdAt: Date.now(),
    id: "story:v1:0xa1:0x123:0x7:0xabc:logical:BattleStory:0x64",
    tag: "thread:one",
  };
  const envelope = { version: 1, kind: "game", subscriptionId: id, notification };
  await restarted.push(envelope);
  expect(restarted.registration.showNotification).not.toHaveBeenCalled();
  expect((await restarted.send("prepare-automatic", { id })).ok).toBe(true);
  expect((await restarted.send("acknowledge-automatic", { id })).ok).toBe(true);
  restarted.clients.matchAll.mockResolvedValue([]);
  await restarted.push(envelope);
  await restarted.push(envelope);
  expect(restarted.registration.showNotification).toHaveBeenCalledOnce();
  expect(restarted.registration.showNotification).toHaveBeenCalledWith(
    notification.title,
    expect.objectContaining({ tag: "thread:one" }),
  );
  await restarted.click(envelope);
  expect(restarted.clients.openWindow).toHaveBeenCalledWith("https://game.test/enter/0xa1/1");

  expect((await restarted.send("revoke-push", { id })).ok).toBe(true);
  await restarted.push({
    ...envelope,
    notification: { ...notification, id: "story:v1:0xa1:0x123:0x7:0xabc:logical:BattleStory:0x65" },
  });
  await restarted.click(envelope);
  expect(restarted.registration.showNotification).toHaveBeenCalledOnce();
  expect(restarted.clients.openWindow).toHaveBeenCalledOnce();
  expect((await restarted.send("disable")).ok).toBe(true);
  expect((await restarted.send("deliver", { token, payload: { ...local, id: "disabled" } })).value).toBe("suppressed");
});
