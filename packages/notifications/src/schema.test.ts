import { expect, it } from "vitest";
import { parseNotificationPayload } from "./delivery";
import { parseNotificationPreferenceChange, parseNotificationPreferences } from "./preferences";
import { parsePushRegistration, parsePushEnvelope, parseWebPushSubscription } from "./push";
import { parseDirectMessageNotificationInput } from "./direct-message-notification";

const now = 100_000;
const id = "11111111-1111-4111-8111-111111111111";
const notification = {
  version: 1,
  id: "test:1",
  owner: "0x1",
  title: "Title",
  body: "Body",
  target: "/g/0xa1/1",
  createdAt: now,
  expiresAt: now + 120_000,
};
const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/test",
  keys: { p256dh: "B".repeat(87), auth: "A".repeat(22) },
};

it("preserves strict fields, revisions and preference output", () => {
  expect(parseNotificationPreferences({ owner: "0x1", level: "all", revision: 2147483647 })).toStrictEqual({
    owner: "0x1",
    level: "all",
    revision: 2147483647,
  });
  expect(parseNotificationPreferenceChange({ level: "off", revision: 0 })).toStrictEqual({ level: "off", revision: 0 });
  for (const revision of [-1, 1.5, 2147483648, NaN, Infinity])
    expect(() => parseNotificationPreferenceChange({ level: "all", revision })).toThrow("invalid_preferences");
  expect(() => parseNotificationPreferences({ owner: "0x1", level: "all", revision: 0, extra: true })).toThrow(
    "invalid_preferences",
  );
});
it("preserves optional undefined fields on display envelopes and DM inputs", () => {
  const payload = { ...notification, tag: undefined, kind: undefined, dayEnd: undefined };
  expect(parseNotificationPayload(payload, now)).toStrictEqual(payload);
  const input = { messageId: "m", threadId: "t", recipientOwner: "0x1", createdAt: now, senderDisplayName: undefined };
  expect(parseDirectMessageNotificationInput(input)).toStrictEqual(input);
  expect(() => parseDirectMessageNotificationInput({ ...input, text: "private" })).toThrow(
    "invalid_direct_message_notification",
  );
});
it("strips browser extras and absent push options, preserving false and canonical URLs", () => {
  const normalized = { ...subscription, endpoint: "https://fcm.googleapis.com/" };
  expect(
    parseWebPushSubscription({ ...subscription, endpoint: "https://FCM.GOOGLEAPIS.COM:443", expirationTime: null }),
  ).toStrictEqual(normalized);
  expect(
    parsePushRegistration({
      owner: "0x1",
      id,
      token: id,
      subscription,
      gameAlerts: false,
      directMessages: undefined,
      extra: true,
    }),
  ).toStrictEqual({ owner: "0x1", id, token: id, subscription, gameAlerts: false });
  expect(
    parsePushEnvelope({ version: 1, subscriptionId: id, kind: undefined, notification, extra: true }, now),
  ).toStrictEqual({ version: 1, subscriptionId: id, notification });
});
it("keeps public error precedence for malformed push inputs", () => {
  expect(() => parsePushRegistration(null)).toThrow("invalid_push_input");
  expect(() => parsePushRegistration({ owner: "bad", id, token: id })).toThrow("invalid_push_registration");
  expect(() => parsePushRegistration({ owner: "0x1", id, token: id })).toThrow("invalid_push_input");
  expect(() => parseWebPushSubscription({ ...subscription, keys: null })).toThrow("invalid_push_input");
  expect(() => parseWebPushSubscription({ ...subscription, keys: {} })).toThrow("invalid_push_keys");
  expect(() => parsePushEnvelope({ version: 1, subscriptionId: id, kind: "invalid" }, now)).toThrow(
    "invalid_push_kind",
  );
  expect(() => parsePushEnvelope({ version: 1, subscriptionId: id }, now)).toThrow("invalid_notification");
});
it("enforces UTF-16 text limits and a separate UTF-8 envelope budget", () => {
  const exact = { ...notification, title: "😀".repeat(40) };
  expect(parseNotificationPayload(exact, now)).toStrictEqual(exact);
  expect(() => parseNotificationPayload({ ...exact, title: exact.title + "x" }, now)).toThrow("invalid_notification");
  expect(() => parseNotificationPayload({ ...notification, title: "bad\u007f" }, now)).toThrow("invalid_notification");
  const large = {
    ...notification,
    id: "ࠀ".repeat(600),
    title: "ࠀ".repeat(80),
    tag: "ࠀ".repeat(240),
    body: "ࠀ".repeat(240),
  };
  expect(() => parseNotificationPayload(large, now)).toThrow("notification_too_large");
});
it("keeps exact expiry boundaries and day-end correspondence", () => {
  expect(parseNotificationPayload(notification, now)).toStrictEqual(notification);
  expect(() => parseNotificationPayload(notification, notification.expiresAt)).toThrow("expired_notification");
  expect(() => parseNotificationPayload({ ...notification, expiresAt: notification.expiresAt + 1 }, now)).toThrow(
    "expired_notification",
  );
  const day = {
    ...notification,
    kind: "day-end",
    expiresAt: now + 1000,
    dayEnd: { endsAt: 3700, asOf: 100, tomorrowSeconds: 1 },
  };
  expect(parseNotificationPayload(day, now)).toStrictEqual(day);
  expect(() => parseNotificationPayload(day, now - 1)).toThrow("expired_notification");
  expect(() => parseNotificationPayload({ ...day, expiresAt: now + 1001 }, now)).toThrow("invalid_day_end_reminder");
  expect(() => parseNotificationPayload({ ...day, dayEnd: { ...day.dayEnd, extra: true } }, now)).toThrow(
    "invalid_day_end_reminder",
  );
});
