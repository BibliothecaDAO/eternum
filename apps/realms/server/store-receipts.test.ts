import { afterEach, expect, it, vi } from "vitest";

import type { IdentityAuth } from "./auth";
import { readSeal } from "./seal";
import { handleStoreReceipt, type ReceiptWorld, type StoreVerifier } from "./store-receipts";
import { createTestD1 } from "./test-d1";
import { migrationStatements } from "./workerd-harness";

/** Store receipts as the shop's server checks them, in D1 with the production migrations; no real store is asked. */
const OWNER = "0xa1";
const OTHER = "0xb2";

const databases: { close(): Promise<void> }[] = [];
afterEach(async () => {
  for (const database of databases.splice(0)) await database.close();
});

const migrated = async () => {
  const database = createTestD1();
  databases.push(database);
  const { db } = database;
  await db.batch(migrationStatements().map((sql) => db.prepare(sql)));
  for (const realmsId of [OWNER, OTHER])
    await db
      .prepare(
        `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt", "realmsId")
         VALUES (?1, ?1, ?1 || '@realms.test', 1, 1, 1, ?1)`,
      )
      .bind(realmsId)
      .run();
  return db;
};

/** A store that knows the receipts it is given: the receipt text names the transaction and the product, `refused` none. */
const store: StoreVerifier = async (evidence) => {
  const [transactionId, productId] = evidence.split("|");
  return transactionId && productId ? { transactionId, productId } : null;
};

const sendAs = async (
  db: D1Database,
  realmsId: string | null,
  body: unknown,
  overrides: Partial<ReceiptWorld> = {},
) => {
  const auth = {
    api: { getSession: async () => (realmsId ? { user: { realmsId } } : null) },
  } as unknown as IdentityAuth;
  const response = await handleStoreReceipt(
    new Request("https://realms.test/api/shop/receipt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    auth,
    {
      db,
      holderFacts: async () => ({ heldRealmIds: [], ticket: null }),
      verifiers: { apple: store },
      now: () => 100,
      ...overrides,
    },
  );
  return [response.status, await response.json()] as const;
};

const credits = async (db: D1Database) =>
  (await db.prepare('SELECT "receipt", "owner", "fragments", "status" FROM "fragment_credits"').all()).results;

it("credits a Fragment bundle once however often its receipt is sent", async () => {
  const db = await migrated();
  const receipt = { store: "apple", receipt: "tx-1|fragments-500" };
  expect(await sendAs(db, OWNER, receipt)).toEqual([200, { status: "fragments", fragments: 500, repeated: false }]);
  expect(await sendAs(db, OWNER, receipt)).toEqual([200, { status: "fragments", fragments: 500, repeated: true }]);
  expect(await credits(db)).toEqual([{ receipt: "apple:tx-1", owner: OWNER, fragments: 500, status: "pending" }]);
});

it("refuses a receipt another account already used, and credits that account nothing", async () => {
  const db = await migrated();
  await sendAs(db, OWNER, { store: "apple", receipt: "tx-1|fragments-100" });
  expect(await sendAs(db, OTHER, { store: "apple", receipt: "tx-1|fragments-100" })).toEqual([
    409,
    { error: "receipt_used" },
  ]);
  expect((await credits(db)).map(({ owner }) => owner)).toEqual([OWNER]);
});

it("grants nothing for a receipt the store refuses, a product it does not sell, or a store that is not set up", async () => {
  const db = await migrated();
  expect(await sendAs(db, OWNER, { store: "apple", receipt: "garbage" })).toEqual([402, { error: "receipt_refused" }]);
  expect(await sendAs(db, OWNER, { store: "apple", receipt: "tx-2|gold-pack" })).toEqual([
    422,
    { error: "unknown_product" },
  ]);
  expect(await sendAs(db, OWNER, { store: "google", receipt: "tx-3|fragments-100" })).toEqual([
    503,
    { error: "store_unavailable" },
  ]);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const down: StoreVerifier = () => Promise.reject(new Error("Apple: 500"));
  expect(
    await sendAs(db, OWNER, { store: "apple", receipt: "tx-4|fragments-100" }, { verifiers: { apple: down } }),
  ).toEqual([503, { error: "store_unavailable" }]);
  expect(await credits(db)).toEqual([]);
  expect(await readSeal(db, OWNER)).toBeNull();
});

it("refuses an unsigned or malformed request", async () => {
  const db = await migrated();
  expect((await sendAs(db, null, { store: "apple", receipt: "tx|fragments-100" }))[0]).toBe(401);
  expect((await sendAs(db, OWNER, { store: "apple" }))[0]).toBe(400);
  expect((await sendAs(db, OWNER, { store: "steam", receipt: "tx|fragments-100" }))[0]).toBe(400);
});

it("grants the seal at the store price of the buyer's holder level, once", async () => {
  const db = await migrated();
  const nothing = { heldRealmIds: [], ticket: null };
  const holder = { heldRealmIds: [1], ticket: null };
  // A holder's price does not buy a buyer who holds nothing the seal.
  expect(
    await sendAs(db, OWNER, { store: "apple", receipt: "tx-5|seal-holder" }, { holderFacts: async () => nothing }),
  ).toEqual([409, { error: "seal_price_not_for_holder" }]);
  expect(await readSeal(db, OWNER)).toBeNull();
  expect(
    await sendAs(db, OWNER, { store: "apple", receipt: "tx-6|seal-holder" }, { holderFacts: async () => holder }),
  ).toEqual([200, { status: "seal", repeated: false }]);
  expect(await readSeal(db, OWNER)).toEqual({ paid_cents: 499, source: "store", granted_at: 100 });
  // The same receipt again is the same answer; the full price also buys a holder's seal.
  expect(
    await sendAs(db, OWNER, { store: "apple", receipt: "tx-6|seal-holder" }, { holderFacts: async () => holder }),
  ).toEqual([200, { status: "seal", repeated: true }]);
  expect(
    await sendAs(db, OTHER, { store: "apple", receipt: "tx-7|seal" }, { holderFacts: async () => holder }),
  ).toEqual([200, { status: "seal", repeated: false }]);
  expect(
    await sendAs(db, OTHER, { store: "apple", receipt: "tx-6|seal-holder" }, { holderFacts: async () => holder }),
  ).toEqual([200, { status: "seal", repeated: true }]);
});
