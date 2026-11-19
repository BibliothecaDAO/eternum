import type { User } from "better-auth";
import { afterEach, expect, it, vi } from "vitest";

import { accountDeletion } from "./account-deletion";
import type { IdentityAuth } from "./auth";
import type { ShopAccess } from "./shop-game";
import { handlePurchaseCheck, handleStoreReceipt, type ReceiptWorld, type StoreVerifier } from "./store-receipts";
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

/** An account that plays in whichever game the receipt names. */
const seated: ShopAccess = async () => true;
const GAME = { chain: "0x1", game: 1 };

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
      body: JSON.stringify({ ...GAME, ...(body as object) }),
    }),
    auth,
    {
      db,
      access: seated,
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
});

it("refuses an unsigned or malformed request", async () => {
  const db = await migrated();
  expect((await sendAs(db, null, { store: "apple", receipt: "tx|fragments-100" }))[0]).toBe(401);
  expect((await sendAs(db, OWNER, { store: "apple" }))[0]).toBe(400);
  expect((await sendAs(db, OWNER, { store: "steam", receipt: "tx|fragments-100" }))[0]).toBe(400);
});

const ledger = async (db: D1Database) =>
  (await db.prepare('SELECT "receipt", "owner", "outcome" FROM "store_receipts" ORDER BY "receipt"').all()).results;

/** An account's deletion as the deletion endpoint runs it: the real statements, so the ledger and its owner rows change as in production. */
const deleteAccountRows = (db: D1Database, owner: string) =>
  db.batch(accountDeletion(db, { id: owner, email: `${owner}@realms.test` } as unknown as User, owner, 200));

/** A database whose batches wait on `before`, so a test runs another request between a request's reads and its writes. */
const pausedBeforeBatch = (db: D1Database, before: () => Promise<unknown>) =>
  ({
    prepare: db.prepare.bind(db),
    batch: async (statements: D1PreparedStatement[]) => {
      await before();
      return db.batch(statements);
    },
  }) as unknown as D1Database;

/** Lets `parties` requests all arrive before any goes on: each has read what it reads before either writes. */
const meetingOf = (parties: number) => {
  let arrived = 0;
  let open!: () => void;
  const everyoneHere = new Promise<void>((resolve) => (open = resolve));
  return {
    arrive: async () => {
      arrived += 1;
      if (arrived === parties) open();
      await everyoneHere;
    },
    arrivals: () => arrived,
  };
};

it("keeps a Fragment receipt spent after the account's credits are deleted", async () => {
  const db = await migrated();
  await sendAs(db, OWNER, { store: "apple", receipt: "tx-1|fragments-500" });
  await deleteAccountRows(db, OWNER);
  expect(await credits(db)).toEqual([]);
  expect(await sendAs(db, OTHER, { store: "apple", receipt: "tx-1|fragments-500" })).toEqual([
    409,
    { error: "receipt_used" },
  ]);
  expect(await credits(db)).toEqual([]);
});

it("records a verified payment of a product the shop does not sell, grants nothing, and answers its retry the same", async () => {
  const db = await migrated();
  const unknown = { store: "apple", receipt: "tx-2|gold-pack" };
  expect(await sendAs(db, OWNER, unknown)).toEqual([422, { error: "unknown_product" }]);
  expect(await sendAs(db, OWNER, unknown)).toEqual([422, { error: "unknown_product" }]);
  expect(await ledger(db)).toEqual([{ receipt: "apple:tx-2", owner: OWNER, outcome: "unfulfilled_product" }]);
  expect(await sendAs(db, OTHER, unknown)).toEqual([409, { error: "receipt_used" }]);
  expect(await credits(db)).toEqual([]);
});

it("credits one bundle and one answer when the same receipt arrives twice, both past their reads before either writes", async () => {
  const db = await migrated();
  const receipt = { store: "apple", receipt: "tx-1|fragments-500" };
  const meeting = meetingOf(2);
  const racing = pausedBeforeBatch(db, meeting.arrive);
  const answers = await Promise.all([sendAs(racing, OWNER, receipt), sendAs(racing, OWNER, receipt)]);
  expect(meeting.arrivals()).toBeGreaterThanOrEqual(2);
  expect(answers.map(([status]) => status)).toEqual([200, 200]);
  expect(answers.map(([, body]) => (body as { repeated: boolean }).repeated).sort()).toEqual([false, true]);
  expect((await credits(db)).map(({ receipt }) => receipt)).toEqual(["apple:tx-1"]);
});

it("credits the first of two accounts that send the same receipt together, and refuses the other", async () => {
  const db = await migrated();
  const meeting = meetingOf(2);
  const racing = pausedBeforeBatch(db, meeting.arrive);
  const receipt = { store: "apple", receipt: "tx-1|fragments-500" };
  const answers = await Promise.all([sendAs(racing, OWNER, receipt), sendAs(racing, OTHER, receipt)]);
  expect(answers.map(([status]) => status).sort()).toEqual([200, 409]);
  expect(await credits(db)).toHaveLength(1);
  expect(await ledger(db)).toHaveLength(1);
});

it("writes neither the ledger row nor the credit when fulfilment fails inside the batch", async () => {
  const db = await migrated();
  const failing = {
    prepare: db.prepare.bind(db),
    batch: (statements: D1PreparedStatement[]) =>
      db.batch([...statements, db.prepare('INSERT INTO "no_such_table" VALUES (1)')]),
  } as unknown as D1Database;
  await expect(sendAs(failing, OWNER, { store: "apple", receipt: "tx-1|fragments-500" })).rejects.toThrow();
  expect(await ledger(db)).toEqual([]);
  expect(await credits(db)).toEqual([]);
});

it("buys nothing for a payment that finishes after its account was deleted, and keeps the receipt spent", async () => {
  const db = await migrated();
  const deletedMeanwhile = pausedBeforeBatch(db, () => deleteAccountRows(db, OWNER));
  expect(await sendAs(deletedMeanwhile, OWNER, { store: "apple", receipt: "tx-1|fragments-500" })).toEqual([
    410,
    { error: "account_deleted" },
  ]);
  expect(await sendAs(db, OTHER, { store: "apple", receipt: "tx-1|fragments-500" })).toEqual([
    409,
    { error: "receipt_used" },
  ]);
  expect(await ledger(db)).toEqual([{ receipt: "apple:tx-1", owner: null, outcome: "unfulfilled_deleted" }]);
  expect(await credits(db)).toEqual([]);
});

it("records a verified payment of an account outside the named game for refund, grants nothing, and answers its retry the same", async () => {
  const db = await migrated();
  const outside: ShopAccess = async () => false;
  for (const receipt of ["tx-1|fragments-500", "tx-2|fragments-100"]) {
    const request = { store: "apple", receipt };
    const refused = [404, { error: "no_shop_outside_a_frontier_game" }];
    expect(await sendAs(db, OWNER, request, { access: outside })).toEqual(refused);
    expect(await sendAs(db, OWNER, request, { access: outside })).toEqual(refused);
  }
  expect(await ledger(db)).toEqual([
    { receipt: "apple:tx-1", owner: OWNER, outcome: "unfulfilled_not_in_game" },
    { receipt: "apple:tx-2", owner: OWNER, outcome: "unfulfilled_not_in_game" },
  ]);
  expect(await credits(db)).toEqual([]);
});

it("records a payment while the game's shard cannot say who plays, and settles the retry once it can", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const db = await migrated();
  const request = { store: "apple", receipt: "tx-1|fragments-500" };
  const unreadable: ShopAccess = () => Promise.reject(new Error("shard down"));
  expect(await sendAs(db, OWNER, request, { access: unreadable })).toEqual([503, { error: "shop_unavailable" }]);
  expect(await ledger(db)).toEqual([{ receipt: "apple:tx-1", owner: OWNER, outcome: "pending_eligibility" }]);
  expect(await credits(db)).toEqual([]);
  expect(await sendAs(db, OWNER, request)).toEqual([200, { status: "fragments", fragments: 500, repeated: false }]);
  expect(await credits(db)).toEqual([{ receipt: "apple:tx-1", owner: OWNER, fragments: 500, status: "pending" }]);
});

it("asks the game the receipt names, and refuses a receipt that names none", async () => {
  const db = await migrated();
  const asked: unknown[] = [];
  const access: ShopAccess = async (realmsId, game) => {
    asked.push([realmsId, game]);
    return true;
  };
  const request = { store: "apple", receipt: "tx-1|fragments-500", chain: "0x2a", game: 7 };
  expect((await sendAs(db, OWNER, request, { access }))[0]).toBe(200);
  expect(asked).toEqual([[OWNER, { chainId: "0x2a", gameId: 7 }]]);
  expect((await sendAs(db, OWNER, { ...request, game: undefined }, { access }))[0]).toBe(400);
});

/** The purchase check as a payment flow would ask it before taking a payment. */
const checkAs = async (realmsId: string | null, body: unknown, access: ShopAccess = seated) => {
  const auth = {
    api: { getSession: async () => (realmsId ? { user: { realmsId } } : null) },
  } as unknown as IdentityAuth;
  const response = await handlePurchaseCheck(
    new Request("https://realms.test/api/shop/purchase-check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...GAME, ...(body as object) }),
    }),
    auth,
    { access },
  );
  return [response.status, await response.json()] as const;
};

it("refuses a purchase check for an account that does not play in the named running Frontier game", async () => {
  const db = await migrated();
  const outside: ShopAccess = async () => false;
  for (const product of ["fragments-500", "fragments-100"])
    expect(await checkAs(OWNER, { product }, outside)).toEqual([404, { error: "no_shop_outside_a_frontier_game" }]);
  expect(await checkAs(null, { product: "fragments-100" })).toEqual([401, { error: "unauthorized" }]);
  expect((await checkAs(OWNER, { product: "fragments-100", game: undefined }))[0]).toBe(400);
  expect(await ledger(db)).toEqual([]);
});

it("approves a product the shop sells for a player of the game it names", async () => {
  const asked: unknown[] = [];
  const access: ShopAccess = async (realmsId, game) => {
    asked.push([realmsId, game]);
    return true;
  };
  expect(await checkAs(OWNER, { product: "fragments-500", chain: "0x2a", game: 7 }, access)).toEqual([
    200,
    { status: "ok" },
  ]);
  expect(asked).toEqual([[OWNER, { chainId: "0x2a", gameId: 7 }]]);
  expect(await checkAs(OWNER, { product: "gold-pack" })).toEqual([422, { error: "unknown_product" }]);
  expect(await checkAs(OWNER, { product: "seal" })).toEqual([422, { error: "unknown_product" }]);
});
