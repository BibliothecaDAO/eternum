import { gamePath, parseNotificationPayload, type LocalNotificationPayload } from "./delivery";
import { pushGameName, type PushGame } from "./game-name";
import { includesKind, kindTag } from "./notification-kinds";
import type { NotificationLevel } from "./preferences";

/** Armies whose stamina is full again are news at Important: the player can act with them now. */
export const includesArmyRestedNotification = (level: NotificationLevel): boolean => includesKind(level, "army-rested");

/**
 * The armies a player left spent are all rested again: one alert each time, once the last of them is full, so a
 * player who stops playing gets no more. It lives while it is true, until the armies' day ends (`until`), and a newer
 * one in the same game replaces it on the phone.
 */
export function buildArmyRestedNotification(input: {
  chainId: string;
  gameId: number;
  /** When the last of the armies was full. */
  fullAt: number;
  /** When the armies' day ends: an army of an earlier day is no army any more. */
  until: number;
  armies: number;
  owner: string;
  game: PushGame | undefined;
  now: number;
}): LocalNotificationPayload | null {
  if (input.until <= input.now) return null;
  const target = gamePath({ chainId: input.chainId, gameId: input.gameId });
  return parseNotificationPayload(
    {
      version: 1,
      kind: "army-rested",
      id: `rested:v3:${input.chainId}:${input.gameId}:${input.owner}:${input.fullAt}`,
      owner: input.owner,
      title: input.armies === 1 ? "Your army is rested" : "Your armies are rested",
      body: `${pushGameName(input.game)}: ${input.armies === 1 ? "its stamina is" : "their stamina is"} full.`,
      tag: kindTag("army-rested", target),
      target,
      createdAt: input.fullAt,
      expiresAt: input.until,
    },
    input.now,
  );
}
