import { GAME_CHAIN_NAMES } from "@realms-world/chain";
export interface LocalNotificationPayload {
  version: 1;
  id: string;
  owner: string;
  title: string;
  body: string;
  target: string;
  createdAt: number;
  expiresAt: number;
}

/** A display envelope only; no entity rows or arbitrary navigation URLs cross this boundary. */
export function parseNotificationPayload(value: unknown, now: number): LocalNotificationPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_notification");
  const input = value as Record<string, unknown>;
  const fields = ["version", "id", "owner", "title", "body", "target", "createdAt", "expiresAt"];
  if (
    Object.keys(input).some((key) => !fields.includes(key)) ||
    input.version !== 1 ||
    !boundedText(input.id, 600) ||
    !boundedText(input.owner, 80) ||
    !/^0x[\da-f]+$/.test(input.owner) ||
    !boundedText(input.title, 80) ||
    !boundedText(input.body, 240) ||
    typeof input.target !== "string" ||
    !isNotificationTarget(input.target) ||
    !Number.isSafeInteger(input.createdAt) ||
    !Number.isSafeInteger(input.expiresAt)
  )
    throw new Error("invalid_notification");
  const payload = input as unknown as LocalNotificationPayload;
  if (
    payload.createdAt > now + 30_000 ||
    payload.expiresAt <= now ||
    payload.expiresAt <= payload.createdAt ||
    payload.expiresAt - payload.createdAt > 120_000
  )
    throw new Error("expired_notification");
  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > 3072) throw new Error("notification_too_large");
  return payload;
}

function boundedText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
}

/** The Cairo emitters allocate adjacent UUIDs, attacker first and defender second, with no intervening UUID call. */
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
  if (story !== "BattleStory" && !(story === "ResourceTransferStory" && transferType === "Delayed")) return sourceId;
  const firstEntity = story === "BattleStory" ? payload.attacker_id : payload.from_entity_id;
  const secondEntity = story === "BattleStory" ? payload.defender_id : payload.to_entity_id;
  const firstOwner = story === "BattleStory" ? payload.attacker_owner_address : payload.from_entity_owner_address;
  const secondOwner = story === "BattleStory" ? payload.defender_owner_address : payload.to_entity_owner_address;
  const first = sameFelt(value.entity_id, firstEntity) && sameFelt(value.owner, firstOwner);
  const second = sameFelt(value.entity_id, secondEntity) && sameFelt(value.owner, secondOwner);
  if (first === second) throw new Error("Ambiguous mirrored story perspective");
  const id = BigInt(sourceId.slice(sourceId.lastIndexOf(":") + 1));
  if (id < (second ? 1n : 0n)) throw new Error("Invalid mirrored story UUID");
  return `${sourceId.slice(0, sourceId.lastIndexOf(":"))}:logical:${story}:0x${(id - (second ? 1n : 0n)).toString(16)}`;
}

function sameFelt(left: unknown, right: unknown): boolean {
  if (left === undefined || left === null || right === undefined || right === null) return false;
  return BigInt(String(left)) === BigInt(String(right));
}

export function notificationMatchesGame(clientUrl: string, target: string, origin: string): boolean {
  const client = new URL(clientUrl);
  if (client.origin !== origin) return false;
  const game = target.replace(/^\/enter\//, "/play/");
  return client.pathname === target || ["map", "hex", "travel"].some((scene) => client.pathname === `${game}/${scene}`);
}

function isNotificationTarget(target: string): boolean {
  const match = /^\/enter\/([a-z0-9_-]+)\/[a-zA-Z0-9_-]{1,100}$/.exec(target);
  return match !== null && Object.hasOwn(GAME_CHAIN_NAMES, match[1]);
}
