import { afterEach, expect, it, vi } from "vitest";

import type { IdentityAuth } from "./auth";
import { handleFragmentPrice } from "./fragment-price";
import type { LordsQuoteReader } from "./lords-price";
import type { ShopAccess } from "./shop-game";
import { createTestD1 } from "./test-d1";
import { migrationStatements } from "./workerd-harness";

const GAME = "chain=0x1&game=1";
const OWNER = "0xa1";
const market =
  (usdPerLords: number): LordsQuoteReader =>
  async (cents) =>
    BigInt(Math.round((cents / 100 / usdPerLords) * 1e6)) * 10n ** 12n;
const marketDown: LordsQuoteReader = () => Promise.reject(new Error("AVNU: 429"));
const seated: ShopAccess = async () => true;
const signedIn = (realmsId: string | null) =>
  ({ api: { getSession: async () => (realmsId ? { user: { realmsId } } : null) } }) as unknown as IdentityAuth;

const databases: { close(): Promise<void> }[] = [];
afterEach(async () => {
  for (const database of databases.splice(0)) await database.close();
});

const migrated = async () => {
  const database = createTestD1();
  databases.push(database);
  const { db } = database;
  await db.batch(migrationStatements().map((sql) => db.prepare(sql)));
  await db
    .prepare(
      `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt", "realmsId")
       VALUES (?1, ?1, ?1 || '@realms.test', 1, 1, 1, ?1)`,
    )
    .bind(OWNER)
    .run();
  return db;
};

const ask = async (
  db: D1Database,
  query: string,
  options: { realmsId?: string | null; access?: ShopAccess; market?: LordsQuoteReader },
) => {
  const response = await handleFragmentPrice(
    new Request(`https://realms.test/api/shop/fragments?${query}`),
    signedIn(options.realmsId === undefined ? OWNER : options.realmsId),
    {
      db,
      access: options.access ?? seated,
      readLordsQuote: options.market ?? market(0.003637),
      payee: { token: "0x55", treasury: "0x7a", veLords: "0x91b" },
      now: () => 1_000,
    },
  );
  return [response.status, await response.json()] as [number, Record<string, unknown>];
};

const lordsOf = (body: Record<string, unknown>) =>
  Number(BigInt((body.quote as { lordsWei: string }).lordsWei) / 10n ** 18n);

it("prices Fragments at a cent each in LORDS from the market as it is asked, rounded up to 5", async () => {
  const db = await migrated();
  const [status, body] = await ask(db, `${GAME}&fragments=1000`, {});
  expect([status, body.fragments, body.cents, lordsOf(body)]).toEqual([200, 1_000, 1_000, 2_750]);
  expect(lordsOf((await ask(db, `${GAME}&fragments=100`, {}))[1])).toBe(275);
  expect(lordsOf((await ask(db, `${GAME}&fragments=100`, { market: market(0.005) }))[1])).toBe(200);
});

it("offers no quote while the market cannot quote", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const db = await migrated();
  expect(await ask(db, `${GAME}&fragments=100`, { market: marketDown })).toEqual([
    200,
    { fragments: 100, cents: 100, quote: null },
  ]);
});

it("sells 100 Fragments or more, only to a player of a running Frontier game the request names", async () => {
  const db = await migrated();
  expect(await ask(db, `${GAME}&fragments=99`, {})).toEqual([400, { error: "invalid_fragments" }]);
  expect(await ask(db, `${GAME}&fragments=150.5`, {})).toEqual([400, { error: "invalid_fragments" }]);
  expect(await ask(db, `${GAME}`, {})).toEqual([400, { error: "invalid_fragments" }]);
  expect(await ask(db, `${GAME}&fragments=100`, { access: async () => false })).toEqual([
    404,
    { error: "no_shop_outside_a_frontier_game" },
  ]);
  expect(await ask(db, "fragments=100", {})).toEqual([400, { error: "invalid_game" }]);
  expect((await ask(db, `${GAME}&fragments=100`, { realmsId: null }))[0]).toBe(401);
});
