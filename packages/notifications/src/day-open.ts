import { gamePath, parseNotificationPayload, type LocalNotificationPayload } from "./delivery";
import { clockTime, sendableAt } from "./quiet-hours";

/** What the home's claim gives each game day (homeDailyClaim), or null for a home with no claim. */
export interface DayOpenClaim {
  labor: number;
  essence: number;
}

/** A Day open push stops an hour before its day ends: past that, the day is nearly gone. */
const LAST_HOUR_MS = 3_600_000;

/** One player's Day open push for one game day, whatever phone it goes to. Instants are milliseconds. */
export interface DayOpenPush {
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
}

/**
 * When the day's push may first go to a phone: as the day opens, or at 08:00 on the phone's clock when it opens in the
 * phone's quiet hours. Null when under an hour of the day would be left by then.
 */
export const dayOpenSendAt = (
  push: Pick<DayOpenPush, "opensAt" | "endsAt">,
  timeZone: string | null,
): number | null => {
  const sendAt = sendableAt(push.opensAt, timeZone);
  return sendAt < push.endsAt - LAST_HOUR_MS ? sendAt : null;
};

/**
 * The one push a game day sends, worded as it goes at `sendAt` to a phone in `timeZone`: the day is open, what the
 * player's home claims in it, and when it ends on that phone's clock then. Its id and expiry depend on neither, so the
 * same day's push is one alert however late, and on whatever clock, it goes.
 */
export function buildDayOpen(
  push: DayOpenPush & { sendAt: number; timeZone: string | null },
): LocalNotificationPayload {
  const ends = clockTime(push.endsAt, push.timeZone);
  return parseNotificationPayload(
    {
      version: 1,
      kind: "day-open",
      id: `day-open:v1:0x${BigInt(push.chainId).toString(16)}:0x${BigInt(push.worldAddress).toString(16)}:${push.gameId}:${push.day}:${push.owner}`,
      owner: push.owner,
      title: push.last ? "The last day is open" : `Day ${push.day + 1} is open`,
      body: `${push.gameName}: ${dayLine(push.claim, ends, push.last)}`,
      target: gamePath(push),
      createdAt: push.sendAt,
      expiresAt: push.endsAt - LAST_HOUR_MS,
    },
    push.sendAt,
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
