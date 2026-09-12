// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const database = vi.hoisted(() => ({ read: vi.fn(), enable: vi.fn(), disable: vi.fn(), claim: vi.fn() }));
vi.mock("./notification-database", () => ({
  readNotificationDevice: database.read,
  enableNotificationDevice: database.enable,
  disableNotificationDevice: database.disable,
  claimNotification: database.claim,
}));
import { installNotificationWorker } from "./notification-worker";

const now = Date.now();
const payload = {
  version: 1,
  id: "story:1",
  owner: "0x1",
  title: "Battle",
  body: "A battle was confirmed",
  target: "/enter/madara/game-1",
  createdAt: now,
  expiresAt: now + 120_000,
};
function harness() {
  const handlers = new Map<string, (event: any) => void>();
  const client = {
    id: "page",
    url: "https://game.test/play/madara/game-1/map",
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
  return { client, clients, registration, send, click };
}
beforeEach(() => {
  vi.clearAllMocks();
  database.read.mockResolvedValue({ owner: "0x1", token: "token", enabledAt: now - 1000 });
  database.claim.mockResolvedValue(true);
});

it("serializes racing tabs and only displays the winning durable claim", async () => {
  database.claim.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  const h = harness();
  const replies = await Promise.all([h.send(), h.send()]);
  expect(replies.map((reply) => reply.value)).toEqual(["shown", "suppressed"]);
  expect(h.registration.showNotification).toHaveBeenCalledOnce();
  expect(h.registration.showNotification).toHaveBeenCalledWith(
    "Battle",
    expect.objectContaining({ tag: "story:1", data: payload }),
  );
});
it("claims focused activity too, so a later blur cannot turn a duplicate into an OS alert", async () => {
  const h = harness();
  h.client.focused = true;
  h.client.visibilityState = "visible";
  expect((await h.send()).value).toBe("focused");
  expect(database.claim).toHaveBeenCalledOnce();
  expect(h.registration.showNotification).not.toHaveBeenCalled();
});
it("does not compete with a push subscription or send from a different game", async () => {
  const h = harness();
  h.registration.pushManager.getSubscription.mockResolvedValueOnce({} as never);
  expect((await h.send()).value).toBe("push-owned");
  h.client.url = "https://game.test/play/madara/game-2/map";
  expect((await h.send()).value).toBe("game-changed");
  expect(database.claim).not.toHaveBeenCalled();
});
it("rejects invalid payloads and owner changes before touching delivery storage", async () => {
  const h = harness();
  expect((await h.send("deliver", { payload: { ...payload, owner: "0x2" } })).ok).toBe(false);
  expect((await h.send("deliver", { payload: { ...payload, target: "https://evil.test" } })).ok).toBe(false);
  expect((await h.send("deliver", { payload: { ...payload, expiresAt: now - 1 } })).ok).toBe(false);
  expect(database.claim).not.toHaveBeenCalled();
});
it("focuses the matching game without navigation and opens entry only when none matches", async () => {
  const h = harness();
  await h.click(payload);
  expect(h.client.focus).toHaveBeenCalledOnce();
  expect(h.client.navigate).not.toHaveBeenCalled();
  expect(h.clients.openWindow).not.toHaveBeenCalled();
  h.client.url = "https://game.test/play/madara/other/map";
  await h.click(payload);
  expect(h.clients.openWindow).toHaveBeenCalledWith("https://game.test/enter/madara/game-1");
  await h.click({ ...payload, expiresAt: now - 1 });
  expect(h.clients.openWindow).toHaveBeenCalledTimes(1);
  database.read.mockResolvedValue({ owner: "0x2" });
  await h.click(payload);
  expect(h.clients.openWindow).toHaveBeenCalledTimes(1);
});
it("disabling delivery closes only that account's displayed notifications", async () => {
  const h = harness();
  const old = { data: { owner: "0x1" }, close: vi.fn() },
    other = { data: { owner: "0x2" }, close: vi.fn() };
  h.registration.getNotifications.mockResolvedValue([old, other]);
  expect((await h.send("disable")).ok).toBe(true);
  expect(database.disable).toHaveBeenCalledWith("0x1");
  expect(old.close).toHaveBeenCalledOnce();
  expect(other.close).not.toHaveBeenCalled();
});
