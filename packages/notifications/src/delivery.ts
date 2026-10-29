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
  /** A Day open push lives until an hour before its day ends; every other alert lives two minutes. */
  kind?: "day-open";
}

const ALERT_LIFETIME_MS = 120_000;
/** Longer than any game day, so a Day open push can wait for a phone that is out of reach for most of its day. */
const DAY_OPEN_LIFETIME_MS = 48 * 3_600_000;

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
  kind: Schema.optional(Schema.Literal("day-open")),
});

/** A display envelope only; no entity rows or arbitrary navigation URLs cross this boundary. */
export function parseNotificationPayload(value: unknown, now: number): LocalNotificationPayload {
  const payload = decodeNotification(notificationSchema, value, "invalid_notification");
  const current = notificationSchema.check(
    Schema.makeFilter(
      (item) =>
        item.createdAt <= now + 30_000 &&
        item.expiresAt > now &&
        item.expiresAt > item.createdAt &&
        item.expiresAt - item.createdAt <= (item.kind === "day-open" ? DAY_OPEN_LIFETIME_MS : ALERT_LIFETIME_MS),
    ),
  );
  decodeNotification(current, payload, "expired_notification");
  const bounded = notificationSchema.check(
    Schema.makeFilter((item) => new TextEncoder().encode(JSON.stringify(item)).byteLength <= 3072),
  );
  return decodeNotification(bounded, payload, "notification_too_large");
}

/**
 * One action told by two stories is one logical story:
 * - a delayed transfer emits its two perspectives back to back (sender first, receiver second), so they are
 *   consecutive events of one transaction: the story identity's last part is the event's index in the receipt;
 * - a new building is placed and paid for in one transaction, on one hex.
 */
export function logicalStoryIdentity(
  sourceId: string,
  story: string,
  value: Record<string, unknown>,
  payload: Record<string, unknown>,
): string {
  if (isNewBuildingStory(story, payload)) {
    const coord = (payload.coord ?? {}) as { x?: unknown; y?: unknown };
    return `${sourceId.slice(0, sourceId.lastIndexOf(":"))}:logical:building:${String(coord.x)},${String(coord.y)}`;
  }
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

const isNewBuildingStory = (story: string, payload: Record<string, unknown>): boolean =>
  story === "BuildingPaymentStory" || (story === "BuildingPlacementStory" && enumName(payload.change) === "Created");

const enumName = (value: unknown): string | undefined =>
  typeof value === "string" ? value : Object.keys((value ?? {}) as object)[0];

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

/** The app's chat page: where a mention in Global opens. */
export const CHAT_PATH = "/chat";

/** A Blitz slot's lobby, by the slot's name: where a mention in its room opens. The app's lobby route reads the same. */
export const lobbyPath = (slot: string): string => `/blitz/slot-${slot}`;

function isNotificationTarget(target: string): boolean {
  if (target === "/" || target === CHAT_PATH) return true;
  return (
    /^\/g\/0x[0-9a-f]{1,64}\/[1-9][0-9]{0,15}$/.test(target) || /^\/blitz\/slot-[a-z0-9][a-z0-9-]{0,23}$/.test(target)
  );
}
