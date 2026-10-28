import { gamePath, parseNotificationPayload, type LocalNotificationPayload } from "./delivery";
import { clockTime, sendableAt } from "./quiet-hours";

/** What the home's claim gives each game day (homeDailyClaim), or null for a home with no claim. */
export interface DayOpenClaim {
  labor: number;
  essence: number;
}

/** A Day open push stops an hour before its day ends: past that, the day is nearly gone. */
const LAST_HOUR_MS = 3_600_000;

/**
 * The one push a game day sends: the day is open, what the player's home claims in it, and when it ends. It goes when
 * the day opens, or at 08:00 on the phone's clock when it opens in the phone's quiet hours; a day with under an hour
 * left by then sends nothing (null). Times are the phone's; instants are milliseconds.
 */
export function buildDayOpen(input: {
  chainId: string;
  worldAddress: string;
  gameId: number;
  gameName: string;
  /** The day's index in its season; Day 1 is index 0. */
  day: number;
  opensAt: number;
  /** The day's end, or the season's when the season ends first. */
  endsAt: number;
  /** The season ends with this day. */
  last: boolean;
  owner: string;
  claim: DayOpenClaim | null;
  timeZone: string | null;
}): LocalNotificationPayload | null {
  const sendAt = sendableAt(input.opensAt, input.timeZone);
  const expiresAt = input.endsAt - LAST_HOUR_MS;
  if (sendAt >= expiresAt) return null;
  const ends = clockTime(input.endsAt, input.timeZone);
  return parseNotificationPayload(
    {
      version: 1,
      kind: "day-open",
      id: `day-open:v1:0x${BigInt(input.chainId).toString(16)}:0x${BigInt(input.worldAddress).toString(16)}:${input.gameId}:${input.day}:${input.owner}`,
      owner: input.owner,
      title: input.last ? "The last day is open" : `Day ${input.day + 1} is open`,
      body: `${input.gameName}: ${dayLine(input.claim, ends, input.last)}`,
      target: gamePath(input),
      createdAt: sendAt,
      expiresAt,
    },
    sendAt,
  );
}

/** "claim 1,000 Labor and 1,000 Essence before 20:00.", "it ends at 20:00.", or the last day's season end. */
const dayLine = (claim: DayOpenClaim | null, ends: string, last: boolean): string => {
  const parts = [
    ...(claim && claim.labor > 0 ? [`${amount(claim.labor)} Labor`] : []),
    ...(claim && claim.essence > 0 ? [`${amount(claim.essence)} Essence`] : []),
  ];
  if (parts.length === 0) return last ? `the season ends at ${ends}.` : `it ends at ${ends}.`;
  return last
    ? `claim ${parts.join(" and ")}. The season ends at ${ends}.`
    : `claim ${parts.join(" and ")} before ${ends}.`;
};

const amount = (value: number) => value.toLocaleString("en-US");
