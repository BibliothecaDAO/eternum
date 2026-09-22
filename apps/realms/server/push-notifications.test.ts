import { expectedChainId } from "@realms-world/chain";
import { Effect, Layer } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  register: vi.fn(),
  find: vi.fn(),
  revoke: vi.fn(),
  expire: vi.fn(),
  foreground: vi.fn(),
  background: vi.fn(),
  send: vi.fn(),
  enabled: true,
  automatic: false,
}));
vi.mock("./auth", () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock("./env", async () => {
  const { default: webpush } = await import("web-push");
  const keys = webpush.generateVAPIDKeys();
  return {
    serverEnv: {
      WEB_PUSH_ENABLED: "true",
      WEB_PUSH_VAPID_PUBLIC_KEY: keys.publicKey,
      WEB_PUSH_VAPID_PRIVATE_KEY: keys.privateKey,
      WEB_PUSH_VAPID_SUBJECT: "mailto:ops@realms.party",
      CHAT_NOTIFICATION_SECRET: "s".repeat(32),
      get WEB_PUSH_AUTOMATIC_ENABLED() {
        return mocks.automatic ? "true" : "false";
      },
      NOTIFICATION_HERALD_URL: "https://herald.test",
      NOTIFICATION_CHAIN: "madara",
      NOTIFICATION_WORLD_ADDRESS: "0x123",
    },
  };
});
vi.mock("@realms-world/db/client", () => ({ db: {} }));
import { PushSubscriptionStore } from "./push-subscription-store";
import { WebPushSender } from "./web-push-sender";
import { handlePushNotifications } from "./push-notifications";
const id = "11111111-1111-4111-8111-111111111111";
const registration = {
  owner: "0x1",
  id,
  token: id,
  subscription: {
    endpoint: "https://fcm.googleapis.com/fcm/send/test",
    keys: { p256dh: "B".repeat(87), auth: "A".repeat(22) },
  },
};
let sequence = 0;
function request(action: string, body: unknown = registration, method = "POST") {
  return handlePushNotifications(
    new Request(`https://identity.test/api/notifications/push/${action}`, {
      method,
      headers: { "content-type": "application/json", "cf-connecting-ip": `test-${sequence++}` },
      ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
    }),
    `test-${sequence++}`,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.enabled = true;
  mocks.automatic = false;
  mocks.session.mockResolvedValue({ user: { id: "0x1" } });
  mocks.register.mockResolvedValue("registered");
  mocks.find.mockResolvedValue({
    ...registration,
    endpoint: registration.subscription.endpoint,
    ...registration.subscription.keys,
  });
  mocks.revoke.mockResolvedValue(undefined);
  mocks.expire.mockResolvedValue(undefined);
  mocks.foreground.mockResolvedValue(true);
  mocks.background.mockResolvedValue([]);
  mocks.send.mockResolvedValue("accepted");
  Object.defineProperty(PushSubscriptionStore, "layer", {
    value: Layer.succeed(PushSubscriptionStore, {
      register: (input) => Effect.promise(() => mocks.register(input)),
      find: (owner, id) => Effect.promise(() => mocks.find(owner, id)),
      revoke: (id, token) => Effect.promise(() => mocks.revoke(id, token)),
      expire: (owner, id) => Effect.promise(() => mocks.expire(owner, id)),
      setGameForeground: (owner, id, foreground) => Effect.promise(() => mocks.foreground(owner, id, foreground)),
      findDirectMessageDevices: (owner, now) => Effect.promise(() => mocks.background(owner, now)),
    }),
    configurable: true,
  });
  Object.defineProperty(WebPushSender, "layer", {
    value: Layer.succeed(WebPushSender, {
      configuration: () => (mocks.enabled ? { enabled: true, publicKey: "key" } : { enabled: false }),
      send: (subscription, payload) => Effect.promise(() => mocks.send(subscription, payload)),
    }),
    configurable: true,
  });
});
it("authenticates owner-scoped registration and status, validates input, and exposes no credentials", async () => {
  expect(await (await request("subscribe")).json()).toEqual({ id });
  expect(mocks.session).toHaveBeenCalledWith(expect.objectContaining({ query: { disableCookieCache: true } }));
  expect(await (await request("status", { owner: "0x1", id })).json()).toEqual({
    registered: true,
    automatic: null,
    directMessages: false,
  });
  expect((await request("subscribe", { ...registration, owner: "0x2" })).status).toBe(403);
  expect(
    (
      await request("subscribe", {
        ...registration,
        subscription: { ...registration.subscription, endpoint: "https://localhost" },
      })
    ).status,
  ).toBe(400);
  mocks.session.mockResolvedValue(null);
  expect((await request("subscribe")).status).toBe(401);
  expect(mocks.register).toHaveBeenCalledOnce();
});
it("retains revocation while sending is disabled and does not require an expired login cookie", async () => {
  mocks.enabled = false;
  mocks.session.mockResolvedValue(null);
  expect(await (await request("config", undefined, "GET")).json()).toEqual({ enabled: false });
  expect((await request("revoke", { id, token: id })).status).toBe(200);
  expect(mocks.revoke).toHaveBeenCalledWith(id, id);
  expect((await request("revoke", { id, token: "guess" })).status).toBe(400);
});
it("bounds and restricts requests and reports registration conflicts", async () => {
  expect((await request("subscribe", "x".repeat(5000))).status).toBe(400);
  expect((await request("subscribe", undefined, "GET")).status).toBe(405);
  expect((await request("unknown")).status).toBe(404);
  mocks.register.mockResolvedValue("conflict");
  expect((await request("subscribe")).status).toBe(409);
});
it("sends only server-owned test text to this owner's device and expires dead endpoints", async () => {
  const input = { owner: "0x1", id, target: "/enter/0xa1/7" };
  const response = await request("test", input);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ status: "accepted" });
  expect(mocks.send.mock.calls[0]?.[1]).toMatchObject({
    subscriptionId: id,
    notification: { owner: "0x1", title: "Realms background notification", target: input.target },
  });
  expect((await request("test", { ...input, target: "https://evil.test" })).status).toBe(400);
  mocks.send.mockResolvedValue("expired");
  expect((await request("test", input)).status).toBe(410);
  expect(mocks.expire).toHaveBeenCalledWith("0x1", id);
  mocks.find.mockResolvedValue(null);
  expect((await request("test", input)).status).toBe(404);
});

it("isolates request budgets by the socket-aware client supplied by the router", async () => {
  const post = (client: string) =>
    handlePushNotifications(
      new Request("https://identity.test/api/notifications/push/revoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, token: id }),
      }),
      client,
    );
  for (let i = 0; i < 30; i++) expect((await post("socket-a")).status).toBe(200);
  expect((await post("socket-a")).status).toBe(429);
  expect((await post("socket-b")).status).toBe(200);
});

it("exposes the configured automatic source and requires explicit matching-source consent", async () => {
  const source = { chainId: `0x${BigInt(expectedChainId("madara")).toString(16)}`, worldAddress: "0x123" };
  const input = { ...registration, gameAlerts: true, source };
  expect((await request("subscribe", input)).status).toBe(503);
  mocks.automatic = true;
  expect((await (await request("config", undefined, "GET")).json()).automatic).toEqual(source);
  expect((await (await request("config", undefined, "GET")).json()).directMessages).toBe(true);
  expect((await request("subscribe", input)).status).toBe(200);
  expect(mocks.register).toHaveBeenCalledWith(input);
  expect((await request("subscribe", { ...input, source: { ...source, worldAddress: "0x999" } })).status).toBe(503);
  expect((await request("subscribe", { ...input, source: undefined })).status).toBe(400);
});

it("records authenticated foreground presence only for an owned subscription", async () => {
  expect(await (await request("foreground", { owner: "0x1", id, foreground: true })).json()).toEqual({
    foreground: true,
  });
  expect(mocks.foreground).toHaveBeenCalledWith("0x1", id, true);
  expect((await request("foreground", { owner: "0x1", id, foreground: "yes" })).status).toBe(400);
  mocks.foreground.mockResolvedValue(false);
  expect((await request("foreground", { owner: "0x1", id, foreground: false })).status).toBe(404);
});

it("persists explicit DM readiness and reports it without exposing subscription credentials", async () => {
  const input = { ...registration, directMessages: true };
  expect((await request("subscribe", input)).status).toBe(200);
  expect(mocks.register).toHaveBeenCalledWith(input);
  mocks.find.mockResolvedValue({ directMessagesEnabledAt: new Date() });
  expect(await (await request("status", { owner: "0x1", id })).json()).toEqual({
    registered: true,
    automatic: null,
    directMessages: true,
  });
  expect((await request("subscribe", { ...registration, directMessages: "true" })).status).toBe(400);
});
