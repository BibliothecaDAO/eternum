import { describe, expect, it } from "vitest";
import { parsePushRegistration, parseWebPushSubscription, parsePushEnvelope } from "./push";
const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/example",
  keys: { p256dh: "B".repeat(87), auth: "A".repeat(22) },
};
const id = "11111111-1111-4111-8111-111111111111";
it("normalizes browser subscription JSON and bounds keys and device identities", () => {
  expect(
    parsePushRegistration({ owner: "0x1", id, token: id, subscription: { ...subscription, expirationTime: null } }),
  ).toEqual({ owner: "0x1", id, token: id, subscription });
  expect(() => parsePushRegistration({ owner: "anonymous", id, token: id, subscription })).toThrow();
  expect(() => parsePushRegistration({ owner: "0x1", id: "x", token: id, subscription })).toThrow();
  expect(() => parseWebPushSubscription({ ...subscription, keys: { ...subscription.keys, auth: "short" } })).toThrow();
});
it.each([
  "http://fcm.googleapis.com/x",
  "https://localhost/x",
  "https://127.0.0.1/x",
  "https://fcm.googleapis.com.evil.test/x",
  "https://user@fcm.googleapis.com/x",
  "https://fcm.googleapis.com:444/x",
  "https://web.push.apple.com/x#secret",
])("rejects untrusted egress destination %s", (endpoint) => {
  expect(() => parseWebPushSubscription({ ...subscription, endpoint })).toThrow();
});
it.each([
  "https://web.push.apple.com/test",
  "https://updates.push.services.mozilla.com/wpush/v2/test",
  "https://wns2-test.notify.windows.com/w/?token=test",
])("accepts supported provider %s", (endpoint) => {
  expect(parseWebPushSubscription({ ...subscription, endpoint }).endpoint).toBe(endpoint);
});
it("validates the nested notification and its expiry before push dispatch", () => {
  const notification = {
    version: 1,
    id: "test:1",
    owner: "0x1",
    title: "Test",
    body: "Message",
    target: "/enter/madara/game-1",
    createdAt: 1000,
    expiresAt: 2000,
  };
  expect(parsePushEnvelope({ version: 1, subscriptionId: id, notification }, 1001).notification).toEqual(notification);
  expect(() => parsePushEnvelope({ version: 1, subscriptionId: id, notification }, 2000)).toThrow();
  expect(() =>
    parsePushEnvelope(
      { version: 1, subscriptionId: id, notification: { ...notification, target: "https://evil.test" } },
      1001,
    ),
  ).toThrow();
});
