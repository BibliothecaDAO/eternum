import { gamePath, parseNotificationPayload, type LocalNotificationPayload } from "./delivery";
import { clockTime } from "./clock";
import { pushGameName, type PushGame } from "./game-name";
import { kindTag } from "./notification-kinds";

/** A Day open push stops an hour before its day ends: past that, the day is nearly gone. */
const LAST_HOUR_MS = 3_600_000;

/** One player's Day open push for one game day, whatever phone it goes to. Instants are milliseconds. */
export interface DayOpenPush {
  chainId: string;
  worldAddress: string;
  gameId: number;
  game: PushGame;
  /** The day's index in its season; Day 1 is index 0. */
  day: number;
  opensAt: number;
  /** The day's end, or the season's when the season ends first. */
  endsAt: number;
  /** The season ends with this day. */
  last: boolean;
  owner: string;
}

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
      title: push.last ? "Last day is open" : `Day ${push.day + 1} is open`,
      body: `${pushGameName(push.game)}: ${dayLine(ends, push.last)}`,
      tag: kindTag("day-open", gamePath(push)),
      target: gamePath(push),
      createdAt: push.sendAt,
      expiresAt: push.endsAt - LAST_HOUR_MS,
    },
    push.sendAt,
  );
}

const dayLine = (ends: string, last: boolean): string => (last ? `season ends at ${ends}.` : `day ends at ${ends}.`);
