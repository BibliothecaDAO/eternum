import { Context, Data, Effect, Layer } from "effect";
import { automaticPushSourceKey, parseAutomaticPushSource, type PushRegistration } from "@bibliothecadao/notifications";

const PUSH_FOREGROUND_LEASE_MS = 60_000;
const DEVICES_PER_OWNER = 10;

interface PushSubscriptionRow {
  id: string;
  owner: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  revocationHash: string;
  gameAlertsSource: string | null;
  gameAlertsEnabledAt: number | null;
  directMessagesEnabledAt: number | null;
  gameForegroundUntil: number | null;
  createdAt: number;
}

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
    revoke: (id: string, token: string) =>
      storeEffect(async () => {
        await db
          .prepare('DELETE FROM "notification_push_subscriptions" WHERE "id" = ? AND "revocationHash" = ?')
          .bind(id, await tokenHash(token))
          .run();
      }),
    setGameForeground: (owner: string, id: string, foreground: boolean, now = Date.now()) =>
      storeEffect(async () => {
        const updated = await db
          .prepare(
            'UPDATE "notification_push_subscriptions" SET "gameForegroundUntil" = ? WHERE "id" = ? AND "owner" = ? RETURNING "id"',
          )
          .bind(foreground ? now + PUSH_FOREGROUND_LEASE_MS : null, id, owner)
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
         ("id", "owner", "endpoint", "p256dh", "auth", "revocationHash", "gameAlertsSource", "gameAlertsEnabledAt",
          "directMessagesEnabledAt", "createdAt")
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE (SELECT count(*) FROM "notification_push_subscriptions" WHERE "owner" = ?) < ?
       ON CONFLICT DO NOTHING RETURNING "id"`,
    )
    .bind(
      registration.id,
      registration.owner,
      registration.endpoint,
      registration.p256dh,
      registration.auth,
      registration.revocationHash,
      registration.gameAlertsSource,
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
  if (
    registration.gameAlertsSource &&
    (!existing.gameAlertsEnabledAt || existing.gameAlertsSource !== registration.gameAlertsSource)
  ) {
    await db
      .prepare(
        'UPDATE "notification_push_subscriptions" SET "gameAlertsEnabledAt" = ?, "gameAlertsSource" = ? WHERE "id" = ?',
      )
      .bind(registration.createdAt, registration.gameAlertsSource, existing.id)
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
    id: input.id,
    owner: input.owner,
    endpoint: input.subscription.endpoint,
    p256dh: input.subscription.keys.p256dh,
    auth: input.subscription.keys.auth,
    revocationHash: await tokenHash(input.token),
    gameAlertsSource: input.gameAlerts ? automaticPushSourceKey(parseAutomaticPushSource(input.source)) : null,
    gameAlertsEnabledAt: input.gameAlerts ? now : null,
    directMessagesEnabledAt: input.directMessages ? now : null,
    gameForegroundUntil: null,
    createdAt: now,
  };
}

function matchesRegistration(existing: PushSubscriptionRow, expected: PushSubscriptionRow) {
  return (
    existing.endpoint === expected.endpoint &&
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
