import { expect, it } from "vitest";
import { buildDayOpen } from "./day-open";
import { buildArmyRestedNotification } from "./army-rested";
import { isQuietAt, sendableAt } from "./quiet-hours";

const HOUR = 3_600_000;
/** Mon Nov 3 2026, 14:00 in Mumbai (08:30 UTC). */
const opensAt = Date.UTC(2026, 10, 3, 8, 30);
const day = {
  chainId: "0x0a",
  worldAddress: "0x0123",
  gameId: 6,
  gameName: "Devcon",
  day: 1,
  opensAt,
  endsAt: opensAt + 6 * HOUR,
  last: false,
  owner: "0x1",
  claim: { labor: 1000, essence: 0 },
  timeZone: "Asia/Kolkata",
};

it.each([
  ["a held Realm", { labor: 1000, essence: 0 }, "Devcon: claim 1,000 Labor before 20:00."],
  ["a Devcon realm", { labor: 1000, essence: 1000 }, "Devcon: claim 1,000 Labor and 1,000 Essence before 20:00."],
  ["a golden ticket", { labor: 2000, essence: 2000 }, "Devcon: claim 2,000 Labor and 2,000 Essence before 20:00."],
  ["a home with no claim", null, "Devcon: it ends at 20:00."],
] as const)("tells %s's player the day is open, what to claim and when it ends", (_home, claim, body) => {
  expect(buildDayOpen({ ...day, claim })).toMatchObject({
    kind: "day-open",
    title: "Day 2 is open",
    body,
    target: "/g/0x0a/6",
    createdAt: opensAt,
    expiresAt: opensAt + 5 * HOUR,
  });
});

it("names the last day with the season's end", () => {
  expect(buildDayOpen({ ...day, day: 9, last: true })).toMatchObject({
    title: "The last day is open",
    body: "Devcon: claim 1,000 Labor. The season ends at 20:00.",
  });
});

it("waits for 08:00 on a phone whose day opens in its quiet hours, and drops a day nearly gone by then", () => {
  // 23:00 in Mumbai: a 12-hour day still has two hours left at 08:00 after its last-hour cut.
  const night = Date.UTC(2026, 10, 3, 17, 30);
  const morning = Date.UTC(2026, 10, 4, 2, 30);
  expect(buildDayOpen({ ...day, opensAt: night, endsAt: night + 12 * HOUR })).toMatchObject({
    body: "Devcon: claim 1,000 Labor before 11:00.",
    createdAt: morning,
    expiresAt: night + 11 * HOUR,
  });
  // A 10-hour day from 23:00 ends at 09:00: under an hour is left after 08:00, so it sends nothing.
  expect(buildDayOpen({ ...day, opensAt: night, endsAt: night + 10 * HOUR })).toBeNull();
  // The same instant is 12:30 in New York: it goes at once, and names the end in New York time.
  expect(
    buildDayOpen({ ...day, opensAt: night, endsAt: night + 12 * HOUR, timeZone: "America/New_York" }),
  ).toMatchObject({ createdAt: night, body: "Devcon: claim 1,000 Labor before 00:30." });
});

it("reads UTC, with no quiet hours, on a phone that has not reported its zone", () => {
  expect(buildDayOpen({ ...day, timeZone: null })).toMatchObject({
    createdAt: opensAt,
    body: "Devcon: claim 1,000 Labor before 14:30 UTC.",
  });
  expect(isQuietAt(Date.UTC(2026, 10, 3, 2), null)).toBe(false);
});

it("is one push per player and day, whatever phone or wording", () => {
  const id = buildDayOpen(day)!.id;
  expect(buildDayOpen({ ...day, timeZone: "UTC" })!.id).toBe(id);
  expect(buildDayOpen({ ...day, chainId: "0xa", worldAddress: "0x123" })!.id).toBe(id);
  expect(buildDayOpen({ ...day, day: 2 })!.id).not.toBe(id);
  expect(buildDayOpen({ ...day, owner: "0x2" })!.id).not.toBe(id);
});

it("keeps quiet from 22:00 to 08:00 on the phone's clock", () => {
  const mumbai = (hour: number, minute = 0) => Date.UTC(2026, 10, 3, hour - 5, minute - 30);
  expect(isQuietAt(mumbai(21, 59), "Asia/Kolkata")).toBe(false);
  expect(isQuietAt(mumbai(22), "Asia/Kolkata")).toBe(true);
  expect(isQuietAt(mumbai(7, 59), "Asia/Kolkata")).toBe(true);
  expect(isQuietAt(mumbai(8), "Asia/Kolkata")).toBe(false);
  expect(sendableAt(mumbai(3, 17), "Asia/Kolkata")).toBe(mumbai(8));
  expect(sendableAt(mumbai(15), "Asia/Kolkata")).toBe(mumbai(15));
});

it("tells a player once a day that their armies are rested, however many rest", () => {
  const rested = (armyDay: number, fullAt: number) =>
    buildArmyRestedNotification({
      chainId: "0xa",
      gameId: 6,
      day: armyDay,
      fullAt,
      owner: "0x1",
      gameName: "Devcon",
      now: fullAt,
    })!;
  expect(rested(1, opensAt)).toMatchObject({ title: "Your armies are rested", body: "Devcon: their stamina is full." });
  expect(rested(1, opensAt + HOUR).id).toBe(rested(1, opensAt).id);
  expect(rested(2, opensAt).id).not.toBe(rested(1, opensAt).id);
});
