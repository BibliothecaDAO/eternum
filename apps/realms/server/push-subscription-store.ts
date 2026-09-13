import { createHash } from "node:crypto";
import { Context, Data, Effect, Layer } from "effect";
import { and, eq, sql } from "drizzle-orm";
import { notificationPushSubscriptions as subscriptions } from "@realms-world/db";
import { db, type Database } from "@realms-world/db/client";
import type { PushRegistration } from "@bibliothecadao/notifications";

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export function createPushSubscriptionStore(database: Pick<Database, "transaction" | "select" | "delete"> = db) {
  const storeEffect = <T>(work: () => Promise<T>) =>
    Effect.tryPromise({ try: work, catch: () => new PushStorageError() });
  return {
    register: (input: PushRegistration) => storeEffect(() => registerSubscription(database, input)),
    find: (owner: string, id: string) =>
      storeEffect(async () => {
        const [row] = await database
          .select()
          .from(subscriptions)
          .where(and(eq(subscriptions.id, id), eq(subscriptions.owner, owner)));
        return row ?? null;
      }),
    revoke: (id: string, token: string) =>
      storeEffect(async () => {
        await database
          .delete(subscriptions)
          .where(and(eq(subscriptions.id, id), eq(subscriptions.revocationHash, tokenHash(token))));
      }),
    expire: (owner: string, id: string) =>
      storeEffect(async () => {
        await database.delete(subscriptions).where(and(eq(subscriptions.id, id), eq(subscriptions.owner, owner)));
      }),
  };
}
async function registerSubscription(database: Pick<Database, "transaction">, input: PushRegistration) {
  return database.transaction(async (tx) => {
    // Serialize the per-owner device cap, including concurrent first registrations.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.owner}))`);
    const owned = await tx.select().from(subscriptions).where(eq(subscriptions.owner, input.owner));
    const existing = owned.find((row) => row.id === input.id);
    const registration = buildSubscriptionRow(input);
    if (existing) return matchesRegistration(existing, registration) ? ("registered" as const) : ("conflict" as const);
    if (owned.length >= 10) return "limit" as const;
    const rows = await tx
      .insert(subscriptions)
      .values(registration)
      .onConflictDoNothing()
      .returning({ id: subscriptions.id });
    return rows.length ? ("registered" as const) : ("conflict" as const);
  });
}

function buildSubscriptionRow(input: PushRegistration) {
  return {
    id: input.id,
    owner: input.owner,
    endpoint: input.subscription.endpoint,
    p256dh: input.subscription.keys.p256dh,
    auth: input.subscription.keys.auth,
    revocationHash: tokenHash(input.token),
  };
}
function matchesRegistration(
  existing: typeof subscriptions.$inferSelect,
  expected: ReturnType<typeof buildSubscriptionRow>,
) {
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
  static readonly layer = Layer.sync(PushSubscriptionStore, () => createPushSubscriptionStore());
}
