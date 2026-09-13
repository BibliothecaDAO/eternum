import { expect, it } from "vitest";
import { automaticPushSourceKey, parseAutomaticPushSource, notificationMatchesSource } from "./automatic-source";
import { parsePushEnvelope } from "./push";
const source = { chain: "madara" as const, worldAddress: "0x123" };
const notification = {
  version: 1 as const,
  id: "story:v1:madara:0x123:0x7:0xabc:logical:BattleStory:0x64",
  owner: "0x1",
  title: "Battle",
  body: "Game activity",
  target: "/enter/madara/game",
  createdAt: 1000,
  expiresAt: 2000,
};
it("normalizes source keys and matches both identity and target chain", () => {
  expect(automaticPushSourceKey(parseAutomaticPushSource("madara:0x0123"))).toBe("madara:0x123");
  expect(notificationMatchesSource(notification, source)).toBe(true);
  expect(notificationMatchesSource(notification, { ...source, worldAddress: "0x999" })).toBe(false);
  expect(notificationMatchesSource({ ...notification, target: "/enter/appchain/game" }, source)).toBe(false);
});
it("requires automatic envelopes to name the matching source", () => {
  const envelope = {
    version: 1,
    kind: "game",
    source,
    subscriptionId: "11111111-1111-4111-8111-111111111111",
    notification,
  };
  expect(parsePushEnvelope(envelope, 1001).source).toEqual(source);
  expect(() => parsePushEnvelope({ ...envelope, source: undefined }, 1001)).toThrow();
  expect(() => parsePushEnvelope({ ...envelope, source: { ...source, worldAddress: "0x999" } }, 1001)).toThrow();
});
