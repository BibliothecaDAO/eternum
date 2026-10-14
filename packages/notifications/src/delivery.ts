import * as Schema from "effect/Schema";
import { decodeNotification, notificationText } from "./validation";
import { isSameStarknetAddress } from "../../identity/src/address";

export interface LocalNotificationPayload {
  version: 1;
  id: string;
  owner: string;
  title: string;
  body: string;
  tag?: string;
  target: string;
  createdAt: number;
  expiresAt: number;
  kind?: "day-end";
  dayEnd?: { endsAt: number; asOf: number; tomorrowSeconds: number };
}

const notificationSchema = Schema.Struct({
  version: Schema.Literal(1),
  id: notificationText(600),
  owner: notificationText(80).check(Schema.isPattern(/^0x[\da-f]+$/)),
  title: notificationText(80),
  body: notificationText(240),
  tag: Schema.optional(notificationText(240)),
  target: Schema.String.check(Schema.makeFilter(isNotificationTarget)),
  createdAt: Schema.Int,
  expiresAt: Schema.Int,
  kind: Schema.optional(Schema.Literal("day-end")),
  dayEnd: Schema.optional(Schema.Unknown),
});
const dayEndSchema = Schema.Struct({
  endsAt: Schema.Int.check(Schema.isGreaterThan(0)),
  asOf: Schema.Int,
  tomorrowSeconds: Schema.Int.check(Schema.isGreaterThan(0)),
});
const notificationDaySchema = Schema.Struct({
  ...notificationSchema.fields,
  dayEnd: Schema.optional(dayEndSchema),
}).check(
  Schema.makeFilter(
    (payload) =>
      (payload.kind === "day-end") === (payload.dayEnd !== undefined) &&
      (!payload.dayEnd ||
        (payload.dayEnd.endsAt - payload.dayEnd.asOf === 3600 &&
          payload.createdAt === payload.dayEnd.asOf * 1000 &&
          payload.expiresAt === payload.createdAt + 1000)),
  ),
);

/** A display envelope only; no entity rows or arbitrary navigation URLs cross this boundary. */
export function parseNotificationPayload(value: unknown, now: number): LocalNotificationPayload {
  const input = decodeNotification(notificationSchema, value, "invalid_notification");
  const payload = decodeNotification(notificationDaySchema, input, "invalid_day_end_reminder");
  const current = notificationDaySchema.check(
    Schema.makeFilter(
      (item) =>
        item.createdAt <= now + 30_000 &&
        item.expiresAt > now &&
        item.expiresAt > item.createdAt &&
        item.expiresAt - item.createdAt <= 120_000 &&
        (item.dayEnd === undefined || item.createdAt <= now),
    ),
  );
  decodeNotification(current, payload, "expired_notification");
  const bounded = notificationDaySchema.check(
    Schema.makeFilter((item) => new TextEncoder().encode(JSON.stringify(item)).byteLength <= 3072),
  );
  return decodeNotification(bounded, payload, "notification_too_large");
}

/**
 * A delayed transfer emits its two perspectives back to back (sender first, receiver second), so they are consecutive
 * events of one transaction: the story identity's last part is the event's index in the receipt.
 */
export function logicalStoryIdentity(
  sourceId: string,
  story: string,
  value: Record<string, unknown>,
  payload: Record<string, unknown>,
): string {
  const transferType =
    typeof payload.transfer_type === "string"
      ? payload.transfer_type
      : Object.keys((payload.transfer_type ?? {}) as object)[0];
  // A delayed transfer is written once per side; both perspectives are one logical story.
  if (!(story === "ResourceTransferStory" && transferType === "Delayed")) return sourceId;
  const first =
    sameFelt(value.entity_id, payload.from_entity_id) && sameFelt(value.owner, payload.from_entity_owner_address);
  const second =
    sameFelt(value.entity_id, payload.to_entity_id) && sameFelt(value.owner, payload.to_entity_owner_address);
  if (first === second) throw new Error("Ambiguous mirrored story perspective");
  const id = BigInt(sourceId.slice(sourceId.lastIndexOf(":") + 1));
  if (id < (second ? 1n : 0n)) throw new Error("Invalid mirrored story UUID");
  return `${sourceId.slice(0, sourceId.lastIndexOf(":"))}:logical:${story}:0x${(id - (second ? 1n : 0n)).toString(16)}`;
}

function sameFelt(left: unknown, right: unknown): boolean {
  if (left === undefined || left === null || right === undefined || right === null) return false;
  return isSameStarknetAddress(String(left), String(right));
}

export function notificationMatchesGame(clientUrl: string, target: string, origin: string): boolean {
  const client = new URL(clientUrl);
  if (client.origin !== origin) return false;
  return client.pathname === target || notificationTargetForGameClient(clientUrl, origin) === target;
}

/** True only for a same-origin game scene that can surface its own live activity. */
export function isNotificationGameClient(clientUrl: string, origin: string): boolean {
  return notificationTargetForGameClient(clientUrl, origin) !== null;
}

/**
 * A game lives at /g/<chain id>/<game id>; its scenes are one segment deeper. Every game link and every notification
 * target is built here, so a target can only ever name a route the app serves.
 */
export const gamePath = (game: { chainId: string; gameId: number }, scene?: "map" | "hex"): string =>
  `/g/${game.chainId.toLowerCase()}/${game.gameId}${scene ? `/${scene}` : ""}`;

function notificationTargetForGameClient(clientUrl: string, origin: string): string | null {
  const client = new URL(clientUrl);
  if (client.origin !== origin) return null;
  const match = /^\/g\/(0x[0-9a-f]{1,64})\/([1-9][0-9]{0,15})\/(map|hex)\/?$/.exec(client.pathname);
  return match ? gamePath({ chainId: match[1], gameId: Number(match[2]) }) : null;
}

function isNotificationTarget(target: string): boolean {
  if (target === "/") return true;
  return /^\/g\/0x[0-9a-f]{1,64}\/[1-9][0-9]{0,15}$/.test(target);
}
