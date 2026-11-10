import { Effect } from "effect";
import { afterEach, expect, it } from "vitest";

import { PushSubscriptionStore } from "./push-subscription-store";
import { createTestD1 } from "./test-d1";
import { migrationStatements } from "./workerd-harness";

/**
 * Registration and revocation as the identity service stores them, in D1 with the production migrations. A device's
 * registration request can still be running when the device gives up on it (its ten-second timeout) or restarts, and
 * then revokes: the revocation, once acknowledged, must stay final.
 */
const OWNER = "0xa1";
const NEXT_OWNER = "0xb2";
const APNS_TOKEN = "ab01".repeat(16);
const registrationOf = (owner: string, id: string, token: string) => ({
  owner,
  id,
  token,
  apnsToken: APNS_TOKEN,
  gameAlerts: true,
  directMessages: true,
});
const FIRST = registrationOf(OWNER, "5c0f4e1a-2b3d-4c5e-8f6a-7b8c9d0e1f2a", "9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b");
const SECOND = registrationOf(
  NEXT_OWNER,
  "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
  "3d4c5b6a-7f8e-4d9c-8b0a-1f2e3d4c5b6a",
);

const databases: { close(): Promise<void> }[] = [];
afterEach(async () => {
  for (const database of databases.splice(0)) await database.close();
});

const migrated = async () => {
  const database = createTestD1();
  databases.push(database);
  const { db } = database;
  await db.batch(migrationStatements().map((sql) => db.prepare(sql)));
  for (const realmsId of [OWNER, NEXT_OWNER])
    await db
      .prepare(
        `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt", "realmsId")
         VALUES (?1, ?1, ?1 || '@realms.test', 1, 1, 1, ?1)`,
      )
      .bind(realmsId)
      .run();
  return db;
};

/** The store over `db`, as one Worker request reaches it. */
const storeOver = (db: D1Database) =>
  Effect.runPromise(
    Effect.gen(function* () {
      return yield* PushSubscriptionStore;
    }).pipe(Effect.provide(PushSubscriptionStore.layer(db))),
  );

/** `db`, with each registration's insert held just before it runs until `release` is called. */
const holdingInserts = (db: D1Database) => {
  let release = () => undefined as void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let reached = () => undefined as void;
  const atInsert = new Promise<void>((resolve) => (reached = resolve));
  const held = {
    ...db,
    prepare: (sql: string) => {
      const statement = db.prepare(sql);
      if (!sql.includes('INSERT INTO "notification_push_subscriptions"')) return statement;
      return {
        ...statement,
        bind: (...args: unknown[]) => {
          const bound = statement.bind(...args);
          return {
            ...bound,
            first: async () => {
              reached();
              await gate;
              return bound.first();
            },
          };
        },
      };
    },
  } as D1Database;
  return { held, atInsert, release };
};

const run = <T>(effect: Effect.Effect<T, unknown>) => Effect.runPromise(effect);

it("refuses a registration whose insert lands after its id was revoked: the device timed out on it, then revoked", async () => {
  const db = await migrated();
  const inserts = holdingInserts(db);
  const registering = await storeOver(inserts.held);
  const late = run(registering.register(FIRST));
  await inserts.atInsert;

  // The device's request timed out; it revokes on another request, and the service acknowledges.
  await run((await storeOver(db)).revoke(FIRST.id, FIRST.token));
  inserts.release();

  expect(await late).toBe("revoked");
  const store = await storeOver(db);
  expect(await run(store.gameAlertDevices([OWNER]))).toEqual([]);
  expect(await run(store.chatAlertDevices(OWNER, Date.now()))).toEqual([]);
});

it("keeps a revocation final across the app's restart, and the next account then registers the same APNs token", async () => {
  const db = await migrated();
  const inserts = holdingInserts(db);
  const late = run((await storeOver(inserts.held)).register(FIRST));
  await inserts.atInsert;

  // The app restarted with the registration's id and token stored, and its launch revokes them; the old request is
  // still inserting.
  const relaunched = await storeOver(db);
  await run(relaunched.revoke(FIRST.id, FIRST.token));
  await run(relaunched.revoke(FIRST.id, FIRST.token));
  inserts.release();
  expect(await late).toBe("revoked");

  expect(await run(relaunched.register(SECOND))).toBe("registered");
  expect((await run(relaunched.gameAlertDevices([OWNER, NEXT_OWNER]))).map(({ id, owner }) => ({ id, owner }))).toEqual(
    [{ id: SECOND.id, owner: NEXT_OWNER }],
  );
});

it("removes a registration revoked after it was stored, and a revoked id refuses registration for a day", async () => {
  const db = await migrated();
  const store = await storeOver(db);
  expect(await run(store.register(FIRST))).toBe("registered");
  const revokedAt = Date.now();
  await run(store.revoke(FIRST.id, FIRST.token, revokedAt));
  expect(await run(store.find(OWNER, FIRST.id))).toBeNull();
  expect(await run(store.register(FIRST))).toBe("revoked");

  // A day on, another revocation clears the old record, and the id may be registered again.
  await run(store.revoke(SECOND.id, SECOND.token, revokedAt + 25 * 60 * 60 * 1000));
  expect(await run(store.register(FIRST))).toBe("registered");
});

it("records no revocation for an id another token's registration holds", async () => {
  const db = await migrated();
  const store = await storeOver(db);
  expect(await run(store.register(FIRST))).toBe("registered");
  await run(store.revoke(FIRST.id, SECOND.token));
  expect(await run(store.find(OWNER, FIRST.id))).not.toBeNull();
  expect(await db.prepare('SELECT count(*) AS "n" FROM "notification_push_revocations"').first()).toEqual({ n: 0 });
});
