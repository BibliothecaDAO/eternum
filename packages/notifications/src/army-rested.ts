import { gamePath, parseNotificationPayload, type LocalNotificationPayload } from "./delivery";
import { NOTIFICATION_LEVELS, type NotificationLevel } from "./preferences";

/** An army whose stamina is full again is news at the standard level: the player can act with it now. */
export const includesArmyRestedNotification = (level: NotificationLevel): boolean =>
  NOTIFICATION_LEVELS.indexOf(level) >= NOTIFICATION_LEVELS.indexOf("standard");

/**
 * An army of the player's is rested: one alert a day per player and game, the first time one of their armies is full
 * that day (a Frontier game day, else a UTC date), so armies that rest at three times the speed still buzz once. It
 * names one army, since others may still be recovering. It lives two minutes like every alert.
 */
export function buildArmyRestedNotification(input: {
  chainId: string;
  gameId: number;
  /** The day it is for: the Frontier day's index, or the UTC date's number in a game without days. */
  day: number;
  fullAt: number;
  owner: string;
  gameName: string;
  now: number;
}): LocalNotificationPayload | null {
  if (input.fullAt + 120_000 <= input.now) return null;
  return parseNotificationPayload(
    {
      version: 1,
      id: `rested:v2:${input.chainId}:${input.gameId}:${input.day}:${input.owner}`,
      owner: input.owner,
      title: "An army is rested",
      body: `${input.gameName}: its stamina is full.`,
      target: gamePath({ chainId: input.chainId, gameId: input.gameId }),
      createdAt: input.fullAt,
      expiresAt: input.fullAt + 120_000,
    },
    input.now,
  );
}
