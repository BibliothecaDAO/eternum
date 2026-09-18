import { Effect, Layer } from "effect";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  preference: vi.fn(),
  devices: vi.fn(),
  expire: vi.fn(),
  send: vi.fn(),
  enabled: true,
}));
vi.mock("./env", () => ({ serverEnv: { CHAT_NOTIFICATION_SECRET: "s".repeat(32) } }));
vi.mock("@realms-world/db/client", () => ({ db: {} }));

import { handleDirectMessagePush } from "./direct-message-push";
import { NotificationPreferenceStore } from "./notification-preference-store";
import { PushSubscriptionStore } from "./push-subscription-store";
import { WebPushSender } from "./web-push-sender";

const id = "11111111-1111-4111-8111-111111111111";
const input = {
  messageId: id,
  threadId: "0x1|0x2",
  recipientOwner: "0x2",
  senderDisplayName: "Lady Ada",
  createdAt: Date.now(),
};
const device = {
  id,
  owner: "0x2",
  endpoint: "https://fcm.googleapis.com/fcm/send/test",
  p256dh: "B".repeat(87),
  auth: "A".repeat(22),
};

const request = (body: unknown = input, token = "s".repeat(32)) =>
  handleDirectMessagePush(
    new Request("https://identity.test/api/notifications/direct-message", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
  mocks.enabled = true;
  mocks.preference.mockResolvedValue({ owner: "0x2", level: "important", revision: 1 });
  mocks.devices.mockResolvedValue([device]);
  mocks.expire.mockResolvedValue(undefined);
  mocks.send.mockResolvedValue("accepted");
  Object.defineProperty(NotificationPreferenceStore, "layer", {
    configurable: true,
    value: Layer.succeed(NotificationPreferenceStore, {
      read: (owner) => Effect.promise(() => mocks.preference(owner)),
      save: () => Effect.die("unused"),
    }),
  });
  Object.defineProperty(PushSubscriptionStore, "layer", {
    configurable: true,
    value: Layer.succeed(PushSubscriptionStore, {
      register: () => Effect.die("unused"),
      find: () => Effect.die("unused"),
      revoke: () => Effect.die("unused"),
      setGameForeground: () => Effect.die("unused"),
      findDirectMessageDevices: (owner, now) => Effect.promise(() => mocks.devices(owner, now)),
      expire: (owner, deviceId) => Effect.promise(() => mocks.expire(owner, deviceId)),
    }),
  });
  Object.defineProperty(WebPushSender, "layer", {
    configurable: true,
    value: Layer.succeed(WebPushSender, {
      configuration: () => (mocks.enabled ? { enabled: true, publicKey: "key" } : { enabled: false }),
      send: (subscription, envelope) => Effect.promise(() => mocks.send(subscription, envelope)),
    }),
  });
});

afterEach(() => vi.restoreAllMocks());

it("sends a privacy-safe DM push to each background device", async () => {
  const response = await request();
  expect(response.status).toBe(202);
  expect(await response.json()).toEqual({ accepted: 1, expired: 0, failed: 0, suppressed: false });
  expect(mocks.send).toHaveBeenCalledWith(
    expect.objectContaining({ endpoint: device.endpoint }),
    expect.objectContaining({
      kind: "direct-message",
      subscriptionId: id,
      notification: expect.objectContaining({
        title: "A raven from Lady Ada",
        body: "A private message awaits your reply in Realms.",
        target: "/",
      }),
    }),
  );
  expect(JSON.stringify(mocks.send.mock.calls[0])).not.toContain("content");
});

it("honors account preferences and foreground filtering before provider delivery", async () => {
  mocks.preference.mockResolvedValue({ owner: "0x2", level: "off", revision: 1 });
  expect(await (await request()).json()).toMatchObject({ suppressed: true });
  mocks.preference.mockResolvedValue({ owner: "0x2", level: "important", revision: 1 });
  mocks.devices.mockResolvedValue([]);
  expect(await (await request()).json()).toMatchObject({ suppressed: true });
  expect(mocks.send).not.toHaveBeenCalled();
});

it("rejects untrusted or malformed publishers and removes expired devices", async () => {
  expect((await request(input, "wrong")).status).toBe(401);
  expect((await request({ ...input, content: "private" })).status).toBe(400);
  mocks.send.mockResolvedValue("expired");
  expect(await (await request()).json()).toMatchObject({ expired: 1 });
  expect(mocks.expire).toHaveBeenCalledWith("0x2", id);
});
