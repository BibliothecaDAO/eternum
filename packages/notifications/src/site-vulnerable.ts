import { gamePath, parseNotificationPayload, type LocalNotificationPayload } from "./delivery";
import { kindTag } from "./notification-kinds";

interface DeepPlace {
  chainId: string;
  gameId: number;
  col: number;
  row: number;
  day: number;
  owner: string;
  now: number;
  until: number;
}

export function buildSiteVulnerableNotification(
  input: DeepPlace & { kind: number; siteName: string },
): LocalNotificationPayload | null {
  return deepAlert(input, `site:v1:${input.chainId}:${input.gameId}:${input.owner}:${input.kind}:${input.day}`, {
    title: `${input.siteName} can be taken`,
    body: "An army of yours can take it today.",
  });
}

export function buildRingOpenNotification(
  input: DeepPlace & { ring: number; sites: number },
): LocalNotificationPayload | null {
  return deepAlert(input, `ring:v1:${input.chainId}:${input.gameId}:${input.owner}:${input.ring}:${input.day}`, {
    title: `Ring ${input.ring + 1} has opened`,
    body: `${input.sites} more sites can be taken today.`,
  });
}

function deepAlert(
  place: DeepPlace,
  id: string,
  copy: { title: string; body: string },
): LocalNotificationPayload | null {
  if (place.until <= place.now) return null;
  const target = `${gamePath(place, "map")}?col=${place.col}&row=${place.row}`;
  return parseNotificationPayload(
    {
      version: 1,
      kind: "site-vulnerable",
      id,
      owner: place.owner,
      ...copy,
      tag: kindTag("site-vulnerable", target),
      target,
      createdAt: place.now,
      expiresAt: place.until,
    },
    place.now,
  );
}
