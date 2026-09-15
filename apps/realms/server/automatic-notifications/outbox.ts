import { randomUUID } from "node:crypto";
import { Context, Data, Effect, Layer } from "effect";
import { and, asc, eq, gt, inArray, isNull, isNotNull, lte, or, sql } from "drizzle-orm";
import {
  notificationCheckpoints as checkpoints,
  notificationDeliveries as deliveries,
  notificationPushSubscriptions as subscriptions,
  notificationPreferences as preferences,
} from "@realms-world/db";
import { db, type Database } from "@realms-world/db/client";
import {
  parseStoryHistoryCursor,
  encodeStoryHistoryCursor,
  type StoryHistoryCursor,
} from "@bibliothecadao/eternum/game-sync";
import {
  includesStoryNotification,
  parseNotificationPreferences,
  parseNotificationPayload,
  type LocalNotificationPayload,
} from "@bibliothecadao/notifications";

export interface NotificationCandidate {
  story: string;
  notification: LocalNotificationPayload;
}
export type NotificationLease = typeof deliveries.$inferSelect & { leaseToken: string };
type OutboxDatabase = Pick<Database, "transaction" | "select" | "insert" | "update" | "delete">;
const storage = <T>(operation: string, work: () => Promise<T>) =>
  Effect.tryPromise({ try: work, catch: () => new NotificationOutboxError({ operation }) });

export function createNotificationOutbox(database: OutboxDatabase = db) {
  return {
    checkpoint: (source: string) =>
      storage("checkpoint", async () => {
        const [row] = await database.select().from(checkpoints).where(eq(checkpoints.source, source));
        return row ? parseStoryHistoryCursor(row.cursor) : null;
      }),
    initialize: (source: string, cursor: StoryHistoryCursor) =>
      storage("initialize", async () => {
        await database.insert(checkpoints).values({ source, cursor }).onConflictDoNothing();
      }),
    commit: (
      source: string,
      expected: StoryHistoryCursor,
      next: StoryHistoryCursor,
      candidates: NotificationCandidate[],
      now: number,
    ) => storage("enqueue", () => commitHistoryPage(database, source, expected, next, candidates, now)),
    claim: (source: string, now: number) => storage("claim", () => claimDeliveries(database, source, now)),
    eligible: (lease: NotificationLease, now: number) =>
      storage("eligibility", () => readEligibleDelivery(database, lease, now)),
    finish: (lease: NotificationLease, outcome: string | null, retryAt: number) =>
      storage("finish", async () => {
        await database
          .update(deliveries)
          .set({ outcome, availableAt: new Date(retryAt), leaseToken: null, leaseUntil: null })
          .where(and(eq(deliveries.id, lease.id), eq(deliveries.leaseToken, lease.leaseToken)));
      }),
    metrics: (source: string, now: number) =>
      storage("metrics", async () => {
        const [row] = await database
          .select({
            pending: sql<number>`count(*)::int`,
            oldest: sql<string | null>`min(${deliveries.expiresAt})::text`,
          })
          .from(deliveries)
          .where(and(eq(deliveries.source, source), isNull(deliveries.outcome)));
        if (!row) throw new Error("Missing notification metrics");
        return {
          pending: row.pending,
          oldestAgeMs: row.oldest === null ? 0 : Math.max(0, now - (Number(row.oldest) - 120000)),
        };
      }),
    prune: (now: number) =>
      storage("prune", async () => {
        const rows = await database
          .delete(deliveries)
          .where(lte(deliveries.expiresAt, now))
          .returning({ id: deliveries.id });
        return rows.length;
      }),
  };
}

async function commitHistoryPage(
  database: OutboxDatabase,
  source: string,
  expected: StoryHistoryCursor,
  next: StoryHistoryCursor,
  candidates: NotificationCandidate[],
  now: number,
) {
  return database.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${source}))`);
    const [row] = await tx.select().from(checkpoints).where(eq(checkpoints.source, source));
    if (!row || encodeStoryHistoryCursor(parseStoryHistoryCursor(row.cursor)) !== encodeStoryHistoryCursor(expected))
      return 0;
    const rows = await buildDeliveries(tx, source, candidates, now);
    // Count and enqueue are serialized globally so several source workers cannot exceed the cap.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('notification-outbox-capacity'))`);
    const [size] = await tx.select({ count: sql<number>`count(*)::int` }).from(deliveries);
    if (!size) throw new Error("Missing notification capacity count");
    if (size.count + rows.length > 10000) throw new Error("Notification outbox capacity reached");
    const inserted = rows.length
      ? await tx.insert(deliveries).values(rows).onConflictDoNothing().returning({ id: deliveries.id })
      : [];
    await tx
      .update(checkpoints)
      .set({ cursor: next, updatedAt: new Date(now) })
      .where(eq(checkpoints.source, source));
    return inserted.length;
  });
}

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
async function buildDeliveries(tx: Transaction, source: string, candidates: NotificationCandidate[], now: number) {
  if (!candidates.length) return [];
  const owners = [...new Set(candidates.map(({ notification }) => notification.owner))];
  const devices = await tx
    .select({ device: subscriptions, preference: preferences })
    .from(subscriptions)
    .innerJoin(preferences, eq(preferences.owner, subscriptions.owner))
    .where(
      and(
        inArray(subscriptions.owner, owners),
        isNotNull(subscriptions.gameAlertsEnabledAt),
        eq(subscriptions.gameAlertsSource, source),
        or(isNull(subscriptions.gameForegroundUntil), lte(subscriptions.gameForegroundUntil, new Date(now))),
      ),
    );
  const rows = new Map<string, typeof deliveries.$inferInsert>();
  for (const { story, notification } of candidates) {
    if (notification.expiresAt <= now) continue;
    for (const { device, preference } of devices) {
      if (
        device.owner !== notification.owner ||
        device.gameAlertsEnabledAt!.getTime() > notification.createdAt ||
        !includesStoryNotification(parseNotificationPreferences(preference).level, story)
      )
        continue;
      const id = `${device.id}:${notification.id}`;
      rows.set(id, {
        id,
        source,
        owner: device.owner,
        subscriptionId: device.id,
        story,
        notification,
        expiresAt: notification.expiresAt,
        availableAt: new Date(now),
      });
    }
  }
  return [...rows.values()];
}

async function claimDeliveries(database: OutboxDatabase, source: string, now: number): Promise<NotificationLease[]> {
  return database.transaction(async (tx) => {
    const due = await tx
      .select()
      .from(deliveries)
      .where(
        and(
          eq(deliveries.source, source),
          isNull(deliveries.outcome),
          lte(deliveries.availableAt, new Date(now)),
          gt(deliveries.expiresAt, now),
          or(isNull(deliveries.leaseUntil), lte(deliveries.leaseUntil, new Date(now))),
        ),
      )
      .orderBy(asc(deliveries.availableAt))
      .limit(8)
      .for("update", { skipLocked: true });
    const leases: NotificationLease[] = [];
    for (const row of due) {
      const leaseToken = randomUUID();
      const [claimed] = await tx
        .update(deliveries)
        .set({ leaseToken, leaseUntil: new Date(now + 30000), attempts: row.attempts + 1 })
        .where(eq(deliveries.id, row.id))
        .returning();
      if (!claimed) throw new Error("Notification lease disappeared while locked");
      leases.push({ ...claimed, leaseToken });
    }
    return leases;
  });
}

async function readEligibleDelivery(database: OutboxDatabase, lease: NotificationLease, now: number) {
  const [row] = await database
    .select({ delivery: deliveries, device: subscriptions, preference: preferences })
    .from(deliveries)
    .innerJoin(
      subscriptions,
      and(eq(deliveries.subscriptionId, subscriptions.id), eq(deliveries.owner, subscriptions.owner)),
    )
    .innerJoin(preferences, eq(preferences.owner, deliveries.owner))
    .where(
      and(
        eq(deliveries.id, lease.id),
        eq(deliveries.leaseToken, lease.leaseToken),
        gt(deliveries.leaseUntil, new Date(now)),
        gt(deliveries.expiresAt, now),
        isNull(deliveries.outcome),
        isNotNull(subscriptions.gameAlertsEnabledAt),
        eq(subscriptions.gameAlertsSource, lease.source),
        or(isNull(subscriptions.gameForegroundUntil), lte(subscriptions.gameForegroundUntil, new Date(now))),
      ),
    );
  if (!row || !includesStoryNotification(parseNotificationPreferences(row.preference).level, row.delivery.story))
    return null;
  const notification = parseNotificationPayload(row.delivery.notification, now);
  if (row.device.gameAlertsEnabledAt!.getTime() > notification.createdAt) return null;
  return {
    notification,
    subscription: { endpoint: row.device.endpoint, keys: { p256dh: row.device.p256dh, auth: row.device.auth } },
  };
}
class NotificationOutboxError extends Data.TaggedError("NotificationOutboxError")<{ operation: string }> {}
export class NotificationOutbox extends Context.Service<
  NotificationOutbox,
  ReturnType<typeof createNotificationOutbox>
>()("NotificationOutbox") {
  static readonly layer = Layer.sync(NotificationOutbox, () => createNotificationOutbox());
}
