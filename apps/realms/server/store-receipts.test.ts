import type { User } from "better-auth";
import { afterEach, expect, it, vi } from "vitest";

import { accountDeletion } from "./account-deletion";
import type { IdentityAuth } from "./auth";
import { RealmHoldingsUnavailableError } from "./realm-holdings";
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
  // The same receipt again is the same answer; the full price also buys a holder's seal; another account's receipt is its own.
  expect(
    await sendAs(db, OWNER, { store: "apple", receipt: "tx-6|seal-holder" }, { holderFacts: async () => holder }),
  ).toEqual([200, { status: "seal", repeated: true }]);
  expect(
    await sendAs(db, OTHER, { store: "apple", receipt: "tx-7|seal" }, { holderFacts: async () => holder }),
  ).toEqual([200, { status: "seal", repeated: false }]);
  expect(
    await sendAs(db, OTHER, { store: "apple", receipt: "tx-6|seal-holder" }, { holderFacts: async () => holder }),
  ).toEqual([409, { error: "receipt_used" }]);
});

const HOLDER = { heldRealmIds: [1], ticket: null } as const;
const ledger = async (db: D1Database) =>
  (await db.prepare('SELECT "receipt", "owner", "outcome" FROM "store_receipts" ORDER BY "receipt"').all()).results;
const seals = async (db: D1Database) =>
  (await db.prepare('SELECT "owner", "receipt" FROM "seal" ORDER BY "owner"').all()).results;

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

it("keeps a seal receipt spent after the account that used it is deleted", async () => {
  const db = await migrated();
  await sendAs(db, OWNER, { store: "apple", receipt: "tx-1|seal" });
  await deleteAccountRows(db, OWNER);
  expect(await sendAs(db, OTHER, { store: "apple", receipt: "tx-1|seal" })).toEqual([409, { error: "receipt_used" }]);
  expect(await seals(db)).toEqual([]);
});

it("binds a second paid receipt of an account that already holds the seal, so no one else can use it", async () => {
  const db = await migrated();
  await sendAs(db, OWNER, { store: "apple", receipt: "tx-1|seal" });
  expect(await sendAs(db, OWNER, { store: "apple", receipt: "tx-2|seal" })).toEqual([
    200,
    { status: "seal", repeated: true },
  ]);
  expect(await ledger(db)).toEqual([
    { receipt: "apple:tx-1", owner: OWNER, outcome: "seal" },
    { receipt: "apple:tx-2", owner: OWNER, outcome: "seal_held" },
  ]);
  expect(await sendAs(db, OTHER, { store: "apple", receipt: "tx-2|seal" })).toEqual([409, { error: "receipt_used" }]);
  expect(await seals(db)).toEqual([{ owner: OWNER, receipt: "apple:tx-1" }]);
});

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

it("records a verified payment it cannot honour, grants nothing, and answers its retry the same", async () => {
  const db = await migrated();
  const underpriced = { store: "apple", receipt: "tx-1|seal-holder" };
  const unknown = { store: "apple", receipt: "tx-2|gold-pack" };
  expect(await sendAs(db, OWNER, underpriced)).toEqual([409, { error: "seal_price_not_for_holder" }]);
  expect(await sendAs(db, OWNER, unknown)).toEqual([422, { error: "unknown_product" }]);
  expect(await sendAs(db, OWNER, underpriced, { holderFacts: async () => HOLDER })).toEqual([
    409,
    { error: "seal_price_not_for_holder" },
  ]);
  expect(await ledger(db)).toEqual([
    { receipt: "apple:tx-1", owner: OWNER, outcome: "unfulfilled_price" },
    { receipt: "apple:tx-2", owner: OWNER, outcome: "unfulfilled_product" },
  ]);
  expect(await seals(db)).toEqual([]);
  expect(await sendAs(db, OTHER, underpriced, { holderFacts: async () => HOLDER })).toEqual([
    409,
    { error: "receipt_used" },
  ]);
});

it("answers a retry from the recorded outcome even after the buyer stops being a holder", async () => {
  const db = await migrated();
  const receipt = { store: "apple", receipt: "tx-1|seal-holder" };
  await sendAs(db, OWNER, receipt, { holderFacts: async () => HOLDER });
  expect(await sendAs(db, OWNER, receipt)).toEqual([200, { status: "seal", repeated: true }]);
});

it("buys one seal and one answer when the same receipt arrives twice, both past their reads before either writes", async () => {
  const db = await migrated();
  const receipt = { store: "apple", receipt: "tx-1|seal" };
  const meeting = meetingOf(2);
  const racing = pausedBeforeBatch(db, meeting.arrive);
  const answers = await Promise.all([sendAs(racing, OWNER, receipt), sendAs(racing, OWNER, receipt)]);
  expect(meeting.arrivals()).toBeGreaterThanOrEqual(2);
  expect(answers.map(([status]) => status)).toEqual([200, 200]);
  expect(answers.map(([, body]) => (body as { repeated: boolean }).repeated).sort()).toEqual([false, true]);
  expect(await seals(db)).toEqual([{ owner: OWNER, receipt: "apple:tx-1" }]);
});

it("keeps one seal and records both receipts when two paid receipts of one account are both past their reads before either writes", async () => {
  const db = await migrated();
  const meeting = meetingOf(2);
  const racing = pausedBeforeBatch(db, meeting.arrive);
  const answers = await Promise.all([
    sendAs(racing, OWNER, { store: "apple", receipt: "tx-1|seal" }),
    sendAs(racing, OWNER, { store: "apple", receipt: "tx-2|seal" }),
  ]);
  expect(meeting.arrivals()).toBeGreaterThanOrEqual(2);
  expect(answers.map(([status]) => status)).toEqual([200, 200]);
  expect((await seals(db)).length).toBe(1);
  expect((await ledger(db)).map(({ outcome }) => outcome).sort()).toEqual(["seal", "seal_held"]);
});

it("gives one seal to the first of two accounts that send the same receipt together, and refuses the other", async () => {
  const db = await migrated();
  const meeting = meetingOf(2);
  const racing = pausedBeforeBatch(db, meeting.arrive);
  const receipt = { store: "apple", receipt: "tx-1|seal" };
  const answers = await Promise.all([sendAs(racing, OWNER, receipt), sendAs(racing, OTHER, receipt)]);
  expect(answers.map(([status]) => status).sort()).toEqual([200, 409]);
  expect(await seals(db)).toHaveLength(1);
  expect(await ledger(db)).toHaveLength(1);
});

it("writes neither the ledger row nor the seal when fulfilment fails inside the batch", async () => {
  const db = await migrated();
  const failing = {
    prepare: db.prepare.bind(db),
    batch: (statements: D1PreparedStatement[]) =>
      db.batch([...statements, db.prepare('INSERT INTO "no_such_table" VALUES (1)')]),
  } as unknown as D1Database;
  await expect(sendAs(failing, OWNER, { store: "apple", receipt: "tx-1|seal" })).rejects.toThrow();
  expect(await ledger(db)).toEqual([]);
  expect(await seals(db)).toEqual([]);
});

it("buys nothing for a payment that finishes after its account was deleted, and keeps the receipt spent", async () => {
  const db = await migrated();
  const deletedMeanwhile = pausedBeforeBatch(db, () => deleteAccountRows(db, OWNER));
  expect(await sendAs(deletedMeanwhile, OWNER, { store: "apple", receipt: "tx-1|seal" })).toEqual([
    410,
    { error: "account_deleted" },
  ]);
  expect(await sendAs(db, OTHER, { store: "apple", receipt: "tx-1|seal" })).toEqual([409, { error: "receipt_used" }]);
  expect(await ledger(db)).toEqual([{ receipt: "apple:tx-1", owner: null, outcome: "unfulfilled_deleted" }]);
  expect(await seals(db)).toEqual([]);
  expect(await sendAs(db, OWNER, { store: "apple", receipt: "tx-2|fragments-500" })).toEqual([
    410,
    { error: "account_deleted" },
  ]);
  expect(await credits(db)).toEqual([]);
});

it("records a verified payment while holdings cannot be read, grants nothing, and settles the retry once they can", async () => {
  const db = await migrated();
  const receipt = { store: "apple", receipt: "tx-1|seal-holder" };
  const unavailable = async () => Promise.reject(new RealmHoldingsUnavailableError());
  expect(await sendAs(db, OWNER, receipt, { holderFacts: unavailable })).toEqual([
    503,
    { error: "holdings_unavailable" },
  ]);
  expect(await ledger(db)).toEqual([{ receipt: "apple:tx-1", owner: OWNER, outcome: "pending_eligibility" }]);
  expect(await seals(db)).toEqual([]);
  expect(await sendAs(db, OTHER, receipt, { holderFacts: async () => HOLDER })).toEqual([
    409,
    { error: "receipt_used" },
  ]);
  expect(await sendAs(db, OWNER, receipt, { holderFacts: unavailable })).toEqual([
    503,
    { error: "holdings_unavailable" },
  ]);
  expect(await sendAs(db, OWNER, receipt, { holderFacts: async () => HOLDER })).toEqual([
    200,
    { status: "seal", repeated: false },
  ]);
  expect(await ledger(db)).toEqual([{ receipt: "apple:tx-1", owner: OWNER, outcome: "seal" }]);
  expect(await seals(db)).toEqual([{ owner: OWNER, receipt: "apple:tx-1" }]);
  expect(await sendAs(db, OWNER, receipt)).toEqual([200, { status: "seal", repeated: true }]);
});

it("resolves a pending payment to unfulfilled when the buyer turns out not to hold, never granting the holder price", async () => {
  const db = await migrated();
  const receipt = { store: "apple", receipt: "tx-1|seal-holder" };
  await sendAs(db, OWNER, receipt, { holderFacts: () => Promise.reject(new RealmHoldingsUnavailableError()) });
  expect(await sendAs(db, OWNER, receipt)).toEqual([409, { error: "seal_price_not_for_holder" }]);
  expect(await ledger(db)).toEqual([{ receipt: "apple:tx-1", owner: OWNER, outcome: "unfulfilled_price" }]);
  expect(await seals(db)).toEqual([]);
});
