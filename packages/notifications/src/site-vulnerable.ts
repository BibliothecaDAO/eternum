import { gamePath, parseNotificationPayload, type LocalNotificationPayload } from "./delivery";
import { kindTag } from "./notification-kinds";

/** One site opportunity per player and game day; the link opens the site's map coordinate. */
export function buildSiteVulnerableNotification(input: {
  chainId: string;
  gameId: number;
  siteId: string;
  siteName: string;
  col: number;
  row: number;
  day: number;
  owner: string;
  now: number;
  until: number;
}): LocalNotificationPayload | null {
  if (input.until <= input.now) return null;
  const target = `${gamePath(input, "map")}?col=${input.col}&row=${input.row}`;
  return parseNotificationPayload(
    {
      version: 1,
      kind: "site-vulnerable",
      id: `site:v1:${input.chainId}:${input.gameId}:${input.owner}:${input.siteId}:${input.day}`,
      owner: input.owner,
      title: `${input.siteName} can be taken`,
      body: "An army of yours can clear its remaining guards.",
      tag: kindTag("site-vulnerable", target),
      target,
      createdAt: input.now,
      expiresAt: input.until,
    },
    input.now,
  );
}
