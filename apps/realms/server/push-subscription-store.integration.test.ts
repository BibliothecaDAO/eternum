import { randomUUID } from "node:crypto";
import { notificationPushSubscriptions } from "@realms-world/db";
import { drizzle } from "drizzle-orm/node-postgres";
import { Effect } from "effect";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { createNotificationTestDatabase } from "./notification-test-database";
vi.mock("@realms-world/db/client", () => ({ db: {} }));
import { createPushSubscriptionStore } from "./push-subscription-store";
const databaseUrl = process.env.IDENTITY_TEST_DATABASE_URL;
describe.skipIf(!databaseUrl)("push subscriptions in PostgreSQL", () => {
  let database: Awaited<ReturnType<typeof createNotificationTestDatabase>>;
  let store: ReturnType<typeof createPushSubscriptionStore>;
  const run = Effect.runPromise;
  const subscription = {
    endpoint: "https://fcm.googleapis.com/fcm/send/one",
    keys: { p256dh: "B".repeat(87), auth: "A".repeat(22) },
  };
  const first = { owner: "0x1", id: randomUUID(), token: randomUUID(), subscription };
  beforeAll(async () => {
    database = await createNotificationTestDatabase(databaseUrl!, { notificationPushSubscriptions });
    store = createPushSubscriptionStore(drizzle(database.pool));
  });
  afterAll(async () => {
    await database?.close();
  });
  it("registers idempotently across instances and rejects cross-owner endpoint takeover", async () => {
    expect(await Promise.all([run(store.register(first)), run(store.register(first))])).toEqual([
      "registered",
      "registered",
    ]);
    const other = createPushSubscriptionStore(drizzle(database.pool));
    expect((await run(other.find("0x1", first.id)))?.endpoint).toBe(subscription.endpoint);
    expect(await run(other.find("0x2", first.id))).toBeNull();
    expect(await run(other.register({ ...first, owner: "0x2", id: randomUUID(), token: randomUUID() }))).toBe(
      "conflict",
    );
    expect(await run(other.register({ ...first, token: randomUUID() }))).toBe("conflict");
    const rows = await database.pool.query("SELECT revocation_hash FROM notification_push_subscriptions");
    expect(rows.rows[0].revocation_hash).not.toBe(first.token);
  });
  it("enforces the device cap under concurrent writes", async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        run(
          store.register({
            owner: "0x1",
            id: randomUUID(),
            token: randomUUID(),
            subscription: { ...subscription, endpoint: `${subscription.endpoint}-${index}` },
          }),
        ),
      ),
    );
    expect(results.filter((value) => value === "registered")).toHaveLength(9);
    expect(results.filter((value) => value === "limit")).toHaveLength(3);
  });
  it("requires the device revocation capability, isolates expiration, and cascades account deletion", async () => {
    await run(store.revoke(first.id, randomUUID()));
    expect(await run(store.find("0x1", first.id))).not.toBeNull();
    await run(store.expire("0x2", first.id));
    expect(await run(store.find("0x1", first.id))).not.toBeNull();
    await run(store.revoke(first.id, first.token));
    await run(store.revoke(first.id, first.token));
    expect(await run(store.find("0x1", first.id))).toBeNull();
    await database.pool.query(`DELETE FROM "user" WHERE id = '0x1'`);
    expect((await database.pool.query("SELECT * FROM notification_push_subscriptions")).rows).toEqual([]);
  });
});
