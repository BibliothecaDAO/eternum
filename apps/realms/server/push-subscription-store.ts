import { Context, Data, Effect, Layer } from "effect";
import type { PushRegistration } from "@bibliothecadao/notifications";

const PUSH_FOREGROUND_LEASE_MS = 60_000;
const DEVICES_PER_OWNER = 10;

/** Where a device's pushes go: a browser's Web Push endpoint and keys, or the iOS app's APNs device token. */
type PushTransport =
  | { kind: "web"; endpoint: string; p256dh: string; auth: string; apnsToken: null }
  | { kind: "apns"; apnsToken: string; endpoint: null; p256dh: null; auth: null };

export type PushSubscriptionRow = PushTransport & {
  id: string;
  owner: string;
  revocationHash: string;
  gameAlertsEnabledAt: number | null;
  directMessagesEnabledAt: number | null;
  gameForegroundUntil: number | null;
  /** The phone's IANA zone, as it last reported it; null until it does. */
  timeZone: string | null;
  createdAt: number;
};

const tokenHash = async (token: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

function createPushSubscriptionStore(db: D1Database) {
  const storeEffect = <T>(work: () => Promise<T>) =>
    Effect.tryPromise({ try: work, catch: () => new PushStorageError() });
  return {
    register: (input: PushRegistration) => storeEffect(() => registerSubscription(db, input)),
    find: (owner: string, id: string) =>
      storeEffect(() =>
        db
          .prepare('SELECT * FROM "notification_push_subscriptions" WHERE "id" = ? AND "owner" = ?')
          .bind(id, owner)
          .first<PushSubscriptionRow>(),
      ),
    /** Devices of these accounts that opted in to game alerts. */
    gameAlertDevices: (owners: readonly string[]) =>
      storeEffect(async () => {
        if (owners.length === 0) return [];
        const { results } = await db
          .prepare(
            `SELECT * FROM "notification_push_subscriptions" WHERE "gameAlertsEnabledAt" IS NOT NULL AND "owner" IN (${owners.map(() => "?").join(", ")})`,
          )
          .bind(...owners)
          .all<PushSubscriptionRow>();
        return results;
      }),
    /**
     * Devices of this account that opted in to chat alerts (a private message, a mention: the consent a device gives as
     * directMessages) and have no game window in the foreground.
     */
    chatAlertDevices: (owner: string, now: number) =>
      storeEffect(async () => {
        const { results } = await db
          .prepare(
            `SELECT * FROM "notification_push_subscriptions" WHERE "owner" = ? AND "directMessagesEnabledAt" IS NOT NULL
               AND ("gameForegroundUntil" IS NULL OR "gameForegroundUntil" <= ?)`,
          )
          .bind(owner, now)
          .all<PushSubscriptionRow>();
        return results;
      }),
    /** A push service reported the endpoint or device token gone. */
    expire: (owner: string, id: string) =>
      storeEffect(async () => {
        await db
          .prepare('DELETE FROM "notification_push_subscriptions" WHERE "id" = ? AND "owner" = ?')
          .bind(id, owner)
          .run();
      }),
    revoke: (id: string, token: string) =>
      storeEffect(async () => {
        await db
          .prepare('DELETE FROM "notification_push_subscriptions" WHERE "id" = ? AND "revocationHash" = ?')
          .bind(id, await tokenHash(token))
          .run();
      }),
    /** The game's lease on this device while it is in view, and the device's time zone as the game reads it. */
    setGameForeground: (owner: string, id: string, foreground: boolean, timeZone: string | null, now = Date.now()) =>
      storeEffect(async () => {
        const updated = await db
          .prepare(
            'UPDATE "notification_push_subscriptions" SET "gameForegroundUntil" = ?, "timeZone" = coalesce(?, "timeZone") WHERE "id" = ? AND "owner" = ? RETURNING "id"',
          )
          .bind(foreground ? now + PUSH_FOREGROUND_LEASE_MS : null, timeZone, id, owner)
          .first();
        return updated !== null;
      }),
  };
}

async function registerSubscription(db: D1Database, input: PushRegistration) {
  const registration = await buildSubscriptionRow(input);
  const existing = await db
    .prepare('SELECT * FROM "notification_push_subscriptions" WHERE "id" = ? AND "owner" = ?')
    .bind(input.id, input.owner)
    .first<PushSubscriptionRow>();
  if (existing) return enableRequestedChannels(db, existing, registration);
  // One statement checks the per-owner cap and inserts, so concurrent first registrations cannot exceed it.
  const inserted = await db
    .prepare(
      `INSERT INTO "notification_push_subscriptions"
         ("id", "owner", "kind", "endpoint", "p256dh", "auth", "apnsToken", "revocationHash", "gameAlertsEnabledAt",
          "directMessagesEnabledAt", "createdAt")
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE (SELECT count(*) FROM "notification_push_subscriptions" WHERE "owner" = ?) < ?
       ON CONFLICT DO NOTHING RETURNING "id"`,
    )
    .bind(
      registration.id,
      registration.owner,
      registration.kind,
      registration.endpoint,
      registration.p256dh,
      registration.auth,
      registration.apnsToken,
      registration.revocationHash,
      registration.gameAlertsEnabledAt,
      registration.directMessagesEnabledAt,
      registration.createdAt,
      registration.owner,
      DEVICES_PER_OWNER,
    )
    .first();
  if (inserted) return "registered" as const;
  const owned = await db
    .prepare('SELECT count(*) AS "count" FROM "notification_push_subscriptions" WHERE "owner" = ?')
    .bind(input.owner)
    .first<{ count: number }>();
  return (owned?.count ?? 0) >= DEVICES_PER_OWNER ? ("limit" as const) : ("conflict" as const);
}

async function enableRequestedChannels(
  db: D1Database,
  existing: PushSubscriptionRow,
  registration: PushSubscriptionRow,
) {
  if (!matchesRegistration(existing, registration)) return "conflict" as const;
  if (registration.gameAlertsEnabledAt && !existing.gameAlertsEnabledAt) {
    await db
      .prepare('UPDATE "notification_push_subscriptions" SET "gameAlertsEnabledAt" = ? WHERE "id" = ?')
      .bind(registration.createdAt, existing.id)
      .run();
  }
  if (registration.directMessagesEnabledAt && !existing.directMessagesEnabledAt) {
    await db
      .prepare('UPDATE "notification_push_subscriptions" SET "directMessagesEnabledAt" = ? WHERE "id" = ?')
      .bind(registration.createdAt, existing.id)
      .run();
  }
  return "registered" as const;
}

async function buildSubscriptionRow(input: PushRegistration): Promise<PushSubscriptionRow> {
  const now = Date.now();
  return {
    ...transportOf(input),
    id: input.id,
    owner: input.owner,
    revocationHash: await tokenHash(input.token),
    gameAlertsEnabledAt: input.gameAlerts ? now : null,
    directMessagesEnabledAt: input.directMessages ? now : null,
    gameForegroundUntil: null,
    timeZone: null,
    createdAt: now,
  };
}

function transportOf(input: PushRegistration): PushTransport {
  if ("apnsToken" in input)
    return { kind: "apns", apnsToken: input.apnsToken, endpoint: null, p256dh: null, auth: null };
  const { endpoint, keys } = input.subscription;
  return { kind: "web", endpoint, p256dh: keys.p256dh, auth: keys.auth, apnsToken: null };
}

function matchesRegistration(existing: PushSubscriptionRow, expected: PushSubscriptionRow) {
  return (
    existing.kind === expected.kind &&
    existing.endpoint === expected.endpoint &&
    existing.apnsToken === expected.apnsToken &&
    existing.revocationHash === expected.revocationHash &&
    existing.p256dh === expected.p256dh &&
    existing.auth === expected.auth
  );
}

class PushStorageError extends Data.TaggedError("PushStorageError")<{}> {}
export class PushSubscriptionStore extends Context.Service<
  PushSubscriptionStore,
  ReturnType<typeof createPushSubscriptionStore>
>()("PushSubscriptionStore") {
  static readonly layer = (db: D1Database) => Layer.sync(PushSubscriptionStore, () => createPushSubscriptionStore(db));
}
