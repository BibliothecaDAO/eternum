import { gamePath, parseNotificationPayload, type LocalNotificationPayload } from "./delivery";
import { NOTIFICATION_LEVELS, type NotificationLevel } from "./preferences";

/** An army whose stamina is full again is news at the standard level: the player can act with it now. */
export const includesArmyRestedNotification = (level: NotificationLevel): boolean =>
  NOTIFICATION_LEVELS.indexOf(level) >= NOTIFICATION_LEVELS.indexOf("standard");

/** The alert for one army of one game, the moment its stamina is full; it lives two minutes like every alert. */
export function buildArmyRestedNotification(input: {
  chainId: string;
  gameId: number;
  armyId: number;
  fullAt: number;
  owner: string;
  gameName: string;
  now: number;
}): LocalNotificationPayload | null {
  if (input.fullAt + 120_000 <= input.now) return null;
  return parseNotificationPayload(
    {
      version: 1,
      id: `rested:v1:${input.chainId}:${input.gameId}:${input.armyId}:${input.fullAt}`,
      owner: input.owner,
      title: "Your army is rested",
      body: `${input.gameName}: stamina is full and your army is ready to march.`,
      target: gamePath({ chainId: input.chainId, gameId: input.gameId }),
      createdAt: input.fullAt,
      expiresAt: input.fullAt + 120_000,
    },
    input.now,
  );
}
