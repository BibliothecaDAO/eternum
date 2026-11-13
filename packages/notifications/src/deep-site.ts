import { gamePath, parseNotificationPayload, type LocalNotificationPayload } from "./delivery";
import { pushGameName, type PushGame } from "./game-name";
import { includesKind, kindTag } from "./notification-kinds";
import type { NotificationLevel } from "./preferences";
import { pushCount } from "./push-count";

/** A Deep site another Aspect holds that the player's army can now take is news at Important. */
export const includesDeepSiteNotification = (level: NotificationLevel): boolean => includesKind(level, "deep-sites");

/**
 * A Deep site held by another Aspect has drained to where the player's largest army outside the Deep is 150% of its
 * guard: one alert per site per game day. It lives until the day ends (`until`), when the guards are gone, and a newer
 * one for the same site replaces it on the phone.
 */
export function buildDeepSiteNotification(input: {
  chainId: string;
  gameId: number;
  site: { id: number; name: string };
  day: number;
  /** When the guard came within the army's reach. */
  at: number;
  /** When the day ends. */
  until: number;
  guard: number;
  army: number;
  owner: string;
  game: PushGame | undefined;
  now: number;
}): LocalNotificationPayload | null {
  if (input.until <= input.now) return null;
  const target = gamePath({ chainId: input.chainId, gameId: input.gameId });
  return parseNotificationPayload(
    {
      version: 1,
      kind: "deep-sites",
      id: `deep-site:v1:${input.chainId}:${input.gameId}:${input.owner}:${input.site.id}:${input.day}`,
      owner: input.owner,
      title: `The ${input.site.name} can be taken`,
      body: `${pushGameName(input.game)}: its guard is down to ${pushCount(input.guard)} troops. Your army has ${pushCount(input.army)}.`,
      tag: kindTag("deep-sites", `${target}:${input.site.id}`),
      target,
      createdAt: input.at,
      expiresAt: input.until,
    },
    input.now,
  );
}
