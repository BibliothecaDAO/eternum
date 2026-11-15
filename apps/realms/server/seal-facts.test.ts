import { afterEach, expect, it } from "vitest";

import type { IdentityEnv } from "./env";
import { holderFactsOf, type HoldingsReaders } from "./seal-facts";
import { RealmHoldingsUnavailableError } from "./realm-holdings";
import { createTestD1 } from "./test-d1";
import { migrationStatements } from "./workerd-harness";

/** Holder facts as the shop reads them in production: the marketplace lists, the chain decides. */
const OWNER = "0xa1";
const PLAIN_REALM = 1;
const WONDER_REALM = 87;

const databases: { close(): Promise<void> }[] = [];
afterEach(async () => {
  for (const database of databases.splice(0)) await database.close();
});

const envWithWallet = async () => {
  const database = createTestD1();
  databases.push(database);
  const { db } = database;
  await db.batch(migrationStatements().map((sql) => db.prepare(sql)));
  await db
    .prepare(
      `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt", "realmsId", "address")
       VALUES (?1, ?1, ?1 || '@realms.test', 1, 1, 1, ?1, '0xabc')`,
    )
    .bind(OWNER)
    .run();
  return { DB: db } as unknown as IdentityEnv;
};

const readers = (listed: number[], live: number[]): HoldingsReaders => ({
  listed: async () => listed.map((realmId) => ({ realmId, map: null })),
  holds: async (_env, _wallet, realmId) => live.includes(realmId),
});

it("gives no holder level for Realms the index lists that the wallet no longer holds", async () => {
  const env = await envWithWallet();
  expect(await holderFactsOf(env, readers([PLAIN_REALM, WONDER_REALM], []))(OWNER)).toEqual({
    heldRealmIds: [],
    ticket: null,
  });
});

it("counts a Wonder Realm only while it is held live, and a plain one otherwise", async () => {
  const env = await envWithWallet();
  expect((await holderFactsOf(env, readers([PLAIN_REALM, WONDER_REALM], [PLAIN_REALM]))(OWNER)).heldRealmIds).toEqual([
    PLAIN_REALM,
  ]);
  expect((await holderFactsOf(env, readers([PLAIN_REALM, WONDER_REALM], [WONDER_REALM]))(OWNER)).heldRealmIds).toEqual([
    WONDER_REALM,
  ]);
});

it("fails, and so discounts nothing, when the chain cannot say who holds a Realm", async () => {
  const env = await envWithWallet();
  const down: HoldingsReaders = {
    listed: async () => [{ realmId: PLAIN_REALM, map: null }],
    holds: () => Promise.reject(new RealmHoldingsUnavailableError()),
  };
  await expect(holderFactsOf(env, down)(OWNER)).rejects.toBeInstanceOf(RealmHoldingsUnavailableError);
});
