import { expect, it } from "vitest";
import { buildDayOpen, dayOpenSendAt } from "./day-open";
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
  sendAt: opensAt,
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

it("goes at 08:00 on a phone whose day opens in its quiet hours, and not at all for a day nearly gone by then", () => {
  // 23:00 in Mumbai: a 12-hour day still has two hours left at 08:00 after its last-hour cut.
  const night = Date.UTC(2026, 10, 3, 17, 30);
  const morning = Date.UTC(2026, 10, 4, 2, 30);
  expect(dayOpenSendAt({ opensAt: night, endsAt: night + 12 * HOUR }, "Asia/Kolkata")).toBe(morning);
  // A 10-hour day from 23:00 ends at 09:00: under an hour is left after 08:00, so it sends nothing.
  expect(dayOpenSendAt({ opensAt: night, endsAt: night + 10 * HOUR }, "Asia/Kolkata")).toBeNull();
  // The same instant is 12:30 in New York: it goes at once.
  expect(dayOpenSendAt({ opensAt: night, endsAt: night + 12 * HOUR }, "America/New_York")).toBe(night);
  // No zone reported yet: no quiet hours.
  expect(dayOpenSendAt({ opensAt: night, endsAt: night + 12 * HOUR }, null)).toBe(night);
});

it.each([
  ["Asia/Kolkata", "Devcon: claim 1,000 Labor before 20:00."],
  ["UTC", "Devcon: claim 1,000 Labor before 14:30."],
  ["America/New_York", "Devcon: claim 1,000 Labor before 09:30."],
  [null, "Devcon: claim 1,000 Labor before 14:30 UTC."],
] as const)("names the day's end on the clock of the phone it goes to (%s), with one id and expiry", (zone, body) => {
  const sent = buildDayOpen({ ...day, timeZone: zone, sendAt: opensAt + HOUR });
  expect(sent).toMatchObject({ body, createdAt: opensAt + HOUR, expiresAt: opensAt + 5 * HOUR });
  expect(sent.id).toBe(buildDayOpen(day).id);
});

it("reads UTC, with no quiet hours, on a phone that has not reported its zone", () => {
  expect(isQuietAt(Date.UTC(2026, 10, 3, 2), null)).toBe(false);
});

it("is one push per player and day, whatever phone or wording", () => {
  const id = buildDayOpen(day).id;
  expect(buildDayOpen({ ...day, timeZone: "UTC" }).id).toBe(id);
  expect(buildDayOpen({ ...day, chainId: "0xa", worldAddress: "0x123" }).id).toBe(id);
  expect(buildDayOpen({ ...day, day: 2 }).id).not.toBe(id);
  expect(buildDayOpen({ ...day, owner: "0x2" }).id).not.toBe(id);
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

it.each([
  // 23:00 on Oct 31 in New York; the clock goes back an hour that night, so 08:00 is 13:00 UTC, not 12:00.
  ["New York, autumn", "America/New_York", Date.UTC(2026, 10, 1, 3), Date.UTC(2026, 10, 1, 13)],
  // 22:00 on Mar 13 in New York; the clock goes forward an hour that night, so 08:00 is 12:00 UTC, not 13:00.
  ["New York, spring", "America/New_York", Date.UTC(2027, 2, 14, 3), Date.UTC(2027, 2, 14, 12)],
  // Midnight on Oct 25 in Paris; summer time ends that night, so 08:00 is 07:00 UTC.
  ["Paris, autumn", "Europe/Paris", Date.UTC(2026, 9, 24, 22), Date.UTC(2026, 9, 25, 7)],
] as const)("waits for 08:00 on the phone's clock across its clock change: %s", (_case, zone, night, morning) => {
  expect(sendableAt(night, zone)).toBe(morning);
  expect(isQuietAt(morning, zone)).toBe(false);
  expect(isQuietAt(morning - 1000, zone)).toBe(true);
});

it("tells a player once a day that an army is rested, however many rest", () => {
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
  expect(rested(1, opensAt)).toMatchObject({ title: "An army is rested", body: "Devcon: its stamina is full." });
  expect(rested(1, opensAt + HOUR).id).toBe(rested(1, opensAt).id);
  expect(rested(2, opensAt).id).not.toBe(rested(1, opensAt).id);
});
