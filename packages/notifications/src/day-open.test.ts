import { expect, it } from "vitest";
import { buildDayOpen } from "./day-open";
import { buildArmyRestedNotification } from "./army-rested";

const HOUR = 3_600_000;
/** Mon Nov 3 2026, 14:00 in Mumbai (08:30 UTC). */
const opensAt = Date.UTC(2026, 10, 3, 8, 30);
const day = {
  chainId: "0x0a",
  worldAddress: "0x0123",
  gameId: 6,
  game: { mode: "frontier" as const },
  day: 1,
  opensAt,
  endsAt: opensAt + 6 * HOUR,
  last: false,
  owner: "0x1",
  sendAt: opensAt,
  timeZone: "Asia/Kolkata",
};

it("tells the player the day is open and when it ends", () => {
  expect(buildDayOpen(day)).toMatchObject({
    kind: "day-open",
    title: "Day 2 is open",
    body: "Frontier: day ends at 20:00.",
    target: "/g/0x0a/6",
    createdAt: opensAt,
    expiresAt: opensAt + 5 * HOUR,
  });
});

it("names the last day with the season's end", () => {
  expect(buildDayOpen({ ...day, day: 9, last: true })).toMatchObject({
    title: "Last day is open",
    body: "Frontier: season ends at 20:00.",
  });
});

it.each([
  ["Asia/Kolkata", "Frontier: day ends at 20:00."],
  ["UTC", "Frontier: day ends at 14:30."],
  ["America/New_York", "Frontier: day ends at 09:30."],
  [null, "Frontier: day ends at 14:30 UTC."],
] as const)("names the day's end on the clock of the phone it goes to (%s), with one id and expiry", (zone, body) => {
  const sent = buildDayOpen({ ...day, timeZone: zone, sendAt: opensAt + HOUR });
  expect(sent).toMatchObject({ body, createdAt: opensAt + HOUR, expiresAt: opensAt + 5 * HOUR });
  expect(sent.id).toBe(buildDayOpen(day).id);
});

it("is one push per player and day, whatever phone or wording", () => {
  const id = buildDayOpen(day).id;
  expect(buildDayOpen({ ...day, timeZone: "UTC" }).id).toBe(id);
  expect(buildDayOpen({ ...day, chainId: "0xa", worldAddress: "0x123" }).id).toBe(id);
  expect(buildDayOpen({ ...day, day: 2 }).id).not.toBe(id);
  expect(buildDayOpen({ ...day, owner: "0x2" }).id).not.toBe(id);
});

it("keeps one Day open shown per game: the next day's replaces it", () => {
  expect(buildDayOpen(day).tag).toBe("day-open:/g/0x0a/6");
  expect(buildDayOpen({ ...day, day: 2, owner: "0x2" }).tag).toBe(buildDayOpen(day).tag);
});

it("tells a player each time their armies are all rested, until their day ends, one shown per game", () => {
  const rested = (fullAt: number, armies = 2) =>
    buildArmyRestedNotification({
      chainId: "0xa",
      gameId: 6,
      fullAt,
      until: opensAt + 6 * HOUR,
      armies,
      owner: "0x1",
      game: { mode: "frontier" as const },
      now: fullAt,
    })!;
  expect(rested(opensAt)).toMatchObject({
    kind: "army-rested",
    title: "Your armies are rested",
    body: "Frontier: their stamina is full.",
    tag: "army-rested:/g/0xa/6",
    createdAt: opensAt,
    expiresAt: opensAt + 6 * HOUR,
  });
  expect(rested(opensAt, 1)).toMatchObject({ title: "Your army is rested", body: "Frontier: its stamina is full." });
  // A second refill the same day is a second alert, under the same tag: it replaces the first on the phone.
  expect(rested(opensAt + 2 * HOUR).id).not.toBe(rested(opensAt).id);
  expect(rested(opensAt + 2 * HOUR).tag).toBe(rested(opensAt).tag);
  // Its day over, the armies are gone: nothing to tell.
  expect(rested(opensAt + 6 * HOUR)).toBeNull();
});
