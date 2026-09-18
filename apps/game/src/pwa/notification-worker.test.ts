// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const database = vi.hoisted(() => ({
  read: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
  claim: vi.fn(),
  pushRead: vi.fn(),
  pushPrepare: vi.fn(),
  pushActivate: vi.fn(),
  pushRevoke: vi.fn(),
  pushForget: vi.fn(),
  configureAutomatic: vi.fn(),
}));
vi.mock("./notification-database", () => ({
  readNotificationDevice: database.read,
  configureAutomaticPush: database.configureAutomatic,
  readPushNotificationDevice: database.pushRead,
  preparePushNotificationDevice: database.pushPrepare,
  activatePushNotificationDevice: database.pushActivate,
  revokePushNotificationDevice: database.pushRevoke,
  forgetPushNotificationDevice: database.pushForget,
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
beforeEach(() => {
  vi.clearAllMocks();
  database.read.mockResolvedValue({ owner: "0x1", token: "token", enabledAt: now - 1000 });
  database.claim.mockResolvedValue(true);
  database.pushRead.mockResolvedValue(undefined);
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
it("claims visible activity without trusting focus, so a later hide cannot turn a duplicate into an OS alert", async () => {
  const h = harness();
  h.client.visibilityState = "visible";
  expect((await h.send()).value).toBe("foreground");
  expect(database.claim).toHaveBeenCalledOnce();
  expect(h.registration.showNotification).not.toHaveBeenCalled();
});
it("reports a visible game client without relying on its focus flag", async () => {
  const h = harness();
  h.client.visibilityState = "visible";
  expect((await h.send("game-foreground-status")).value).toBe(true);
  h.client.url = "https://game.test/";
  expect((await h.send("game-foreground-status")).value).toBe(false);
});
it("keeps local alerts during the push-test preview but rejects a different game", async () => {
  const h = harness();
  h.registration.pushManager.getSubscription.mockResolvedValueOnce({} as never);
  expect((await h.send()).value).toBe("shown");
  h.client.url = "https://game.test/play/madara/game-2/map";
  expect((await h.send()).value).toBe("game-changed");
  expect(database.claim).toHaveBeenCalledOnce();
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

const subscriptionId = "11111111-1111-4111-8111-111111111111";
it("receives server push with no page clients, preserves its collapse tag and routes its click through normal entry", async () => {
  const h = harness();
  h.clients.matchAll.mockResolvedValue([]);
  database.pushRead.mockResolvedValue({
    owner: "0x1",
    id: subscriptionId,
    token: "push-token",
    state: "active",
    enabledAt: now - 1000,
  });
  const envelope = { version: 1, subscriptionId, notification: { ...payload, tag: "thread:one" } };
  await h.push(envelope);
  expect(h.registration.showNotification).toHaveBeenCalledOnce();
  expect(h.registration.showNotification).toHaveBeenCalledWith(
    "Battle",
    expect.objectContaining({ tag: "thread:one" }),
  );
  expect(database.claim).toHaveBeenCalledWith(
    expect.objectContaining({ subscriptionId, token: "push-token" }),
    expect.any(Number),
  );
  await h.click({ ...envelope, owner: "0x1" });
  expect(h.clients.openWindow).toHaveBeenCalledWith("https://game.test/enter/madara/game-1");
});
it.each(["revoking", "preparing"])("rejects server push and clicks for a %s registration", async (state) => {
  const h = harness();
  database.pushRead.mockResolvedValue({ owner: "0x1", id: subscriptionId, state });
  const envelope = { version: 1, subscriptionId, notification: payload };
  await h.push(envelope);
  await h.click({ ...envelope, owner: "0x1" });
  expect(h.registration.showNotification).not.toHaveBeenCalled();
  expect(h.clients.openWindow).not.toHaveBeenCalled();
  expect(h.client.focus).not.toHaveBeenCalled();
});
it("focuses an existing game when a direct-message notification is opened", async () => {
  const h = harness();
  database.pushRead.mockResolvedValue({ owner: "0x1", id: subscriptionId, state: "active" });
  await h.click({
    version: 1,
    kind: "direct-message",
    subscriptionId,
    owner: "0x1",
    notification: { ...payload, target: "/" },
  });
  expect(h.client.focus).toHaveBeenCalledOnce();
  expect(h.clients.openWindow).not.toHaveBeenCalled();
});
it("rejects expired or account-mismatched server envelopes", async () => {
  const h = harness();
  database.pushRead.mockResolvedValue({ owner: "0x2", id: subscriptionId, state: "active" });
  await h.push({ version: 1, subscriptionId, notification: payload });
  await h.push({ version: 1, subscriptionId, notification: { ...payload, expiresAt: 1 } });
  expect(h.registration.showNotification).not.toHaveBeenCalled();
});

it("keeps an already-sent automatic push user-visible without a local claim swallowing it", async () => {
  const h = harness();
  database.pushRead.mockResolvedValue({
    owner: "0x1",
    id: subscriptionId,
    token: "push-token",
    state: "active",
    automatic: { chain: "madara", worldAddress: "0x123", acknowledged: true },
  });
  h.client.focused = true;
  h.client.visibilityState = "visible";
  const gamePayload = { ...payload, id: "story:v1:madara:0x123:0x7:0xabc:logical:BattleStory:0x64" };
  expect((await h.send("deliver", { payload: gamePayload })).value).toBe("push-owned");
  expect(database.claim).not.toHaveBeenCalled();
  await h.push({
    version: 1,
    kind: "game",
    source: { chain: "madara", worldAddress: "0x123" },
    subscriptionId,
    notification: { ...payload, id: "story:v1:madara:0x123:0x7:0xabc:logical:BattleStory:0x64" },
  });
  expect(h.registration.showNotification).toHaveBeenCalledOnce();
  expect(database.claim).toHaveBeenCalledWith(
    expect.objectContaining({ automatic: { chain: "madara", worldAddress: "0x123" } }),
    expect.any(Number),
  );
});
it("does not deliver or open automatic alerts on a test-only device", async () => {
  const h = harness();
  database.pushRead.mockResolvedValue({ owner: "0x1", id: subscriptionId, state: "active", automatic: undefined });
  const envelope = {
    version: 1,
    kind: "game",
    source: { chain: "madara", worldAddress: "0x123" },
    subscriptionId,
    notification: { ...payload, id: "story:v1:madara:0x123:0x7:0xabc:logical:BattleStory:0x64" },
  };
  await h.push(envelope);
  await h.click(envelope);
  expect(h.registration.showNotification).not.toHaveBeenCalled();
  expect(h.client.focus).not.toHaveBeenCalled();
});

it("keeps local delivery for other chains and worlds even when automatic push owns one source", async () => {
  const h = harness();
  database.pushRead.mockResolvedValue({
    owner: "0x1",
    id: subscriptionId,
    state: "active",
    automatic: { chain: "appchain", worldAddress: "0x123", acknowledged: true },
  });
  const gamePayload = { ...payload, id: "story:v1:madara:0x123:0x7:0xabc:logical:BattleStory:0x64" };
  expect((await h.send("deliver", { payload: gamePayload })).value).toBe("shown");
  database.pushRead.mockResolvedValue({
    owner: "0x1",
    id: subscriptionId,
    state: "active",
    automatic: { chain: "madara", worldAddress: "0x999", acknowledged: true },
  });
  expect((await h.send("deliver", { payload: gamePayload })).value).toBe("shown");
});
it("keeps local delivery during incomplete automatic setup", async () => {
  const h = harness();
  database.pushRead.mockResolvedValue({
    owner: "0x1",
    id: subscriptionId,
    state: "active",
    automatic: { chain: "madara", worldAddress: "0x123", acknowledged: false },
  });
  expect(
    (
      await h.send("deliver", {
        payload: { ...payload, id: "story:v1:madara:0x123:0x7:0xabc:logical:BattleStory:0x64" },
      })
    ).value,
  ).toBe("shown");
});

it("closes only the revoked registration's notifications and ignores stale revocation", async () => {
  const h = harness();
  const old = { owner: "0x1", id: "11111111-1111-4111-8111-111111111111" };
  const notifications = [
    { data: { owner: old.owner, subscriptionId: old.id }, close: vi.fn() },
    { data: { owner: old.owner, subscriptionId: "replacement" }, close: vi.fn() },
    { data: { owner: "0x2", subscriptionId: old.id }, close: vi.fn() },
  ];
  h.registration.getNotifications.mockResolvedValue(notifications);
  database.pushRevoke.mockResolvedValueOnce(null).mockResolvedValueOnce(old);
  await h.send("revoke-push", { id: old.id });
  expect(notifications.every((notification) => notification.close.mock.calls.length === 0)).toBe(true);
  await h.send("revoke-push", { id: old.id });
  expect(database.pushRevoke).toHaveBeenLastCalledWith(old.owner, old.id);
  expect(notifications.map((notification) => notification.close.mock.calls.length)).toEqual([1, 0, 0]);
});
