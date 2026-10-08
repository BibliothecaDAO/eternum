import { expect, it } from "vitest";
import { buildDayEndReminder, includesDayEndReminder } from "./day-end-reminder";
import { parsePushEnvelope } from "./push";
import { parseNotificationPayload } from "./delivery";

const dueAt = Date.parse("2026-10-08T04:40:00Z");
const input = {
  chainId: "0xa",
  worldAddress: "0x123",
  gameId: 1,
  day: 4,
  owner: "0x1",
  endsAt: dueAt / 1000 + 3600,
  tomorrowSeconds: 12 * 3600,
};

it("Important and All include the Day-end reminder, Off never does", () => {
  expect(includesDayEndReminder("important")).toBe(true);
  expect(includesDayEndReminder("all")).toBe(true);
  expect(includesDayEndReminder("off")).toBe(false);
  expect(includesDayEndReminder("standard")).toBe(true); // The persisted legacy level includes Important.
});

it("carries clock instants, not a server timezone, and expires in the scheduled second", () => {
  const notification = buildDayEndReminder(input);
  expect(notification).toMatchObject({
    kind: "day-end",
    title: "Day-end reminder",
    createdAt: dueAt,
    expiresAt: dueAt + 1000,
    dayEnd: { endsAt: input.endsAt, asOf: dueAt / 1000, tomorrowSeconds: input.tomorrowSeconds },
  });
  const envelope = { version: 1, kind: "game", subscriptionId: "00000000-0000-4000-8000-000000000001", notification };
  expect(parsePushEnvelope(envelope, dueAt).notification).toEqual(notification);
  expect(() => parsePushEnvelope(envelope, dueAt - 1)).toThrow("expired");
  expect(parseNotificationPayload(notification, dueAt + 999)).toEqual(notification);
  expect(() => parsePushEnvelope(envelope, dueAt + 1000)).toThrow("expired");
});

it("one world/game/day/player is one logical reminder, and the next day has a different id", () => {
  expect(buildDayEndReminder(input).id).toBe(buildDayEndReminder({ ...input }).id);
  expect(buildDayEndReminder(input).id).toBe(
    buildDayEndReminder({ ...input, chainId: "0x0a", worldAddress: "0x0123" }).id,
  );
  expect(buildDayEndReminder({ ...input, day: input.day + 1 }).id).not.toBe(buildDayEndReminder(input).id);
  expect(buildDayEndReminder({ ...input, owner: "0x2" }).id).not.toBe(buildDayEndReminder(input).id);
  expect(buildDayEndReminder({ ...input, worldAddress: "0x456" }).id).not.toBe(buildDayEndReminder(input).id);
});

it("rejects malformed reminder instants and a forged late-delivery extension", () => {
  const notification = buildDayEndReminder(input);
  expect(() =>
    parseNotificationPayload({ ...notification, dayEnd: { ...notification.dayEnd, endsAt: "05:40" } }, dueAt),
  ).toThrow();
  expect(() =>
    parseNotificationPayload({ ...notification, dayEnd: { ...notification.dayEnd, tomorrowSeconds: 0 } }, dueAt),
  ).toThrow();
  expect(() => parseNotificationPayload({ ...notification, expiresAt: dueAt + 120000 }, dueAt)).toThrow();
  expect(() =>
    parseNotificationPayload({ ...notification, dayEnd: { ...notification.dayEnd, asOf: dueAt / 1000 + 1 } }, dueAt),
  ).toThrow();
  expect(() => parseNotificationPayload({ ...notification, kind: undefined }, dueAt)).toThrow();
});
