import { afterEach, expect, it, vi } from "vitest";

import type { IdentityAuth } from "./auth";
import { handleSeal, holderLevelOf, sealOffer, type HolderFacts } from "./seal";
import { RealmHoldingsUnavailableError } from "./realm-holdings";
import type { LordsPriceReader } from "./lords-price";
import type { ShopAccess } from "./shop-game";
import { createTestD1 } from "./test-d1";
import { migrationStatements } from "./workerd-harness";

/** The Ancient Seal's holder levels, price and record, in D1 with the production migrations. */
const OWNER = "0xa1";
const OTHER = "0xb2";
/** Realm 1 holds no Wonder; Realm 87 holds one (canonical traits). */
const PLAIN_REALM = 1;
const WONDER_REALM = 87;

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

const GAME = "?chain=0x1&game=1";
/** The market as the Seal route reads it: a price in dollars, or an outage. */
const market =
  (usd: number): LordsPriceReader =>
  async () =>
    usd;
const marketDown: LordsPriceReader = () => Promise.reject(new Error("CoinGecko: 429"));
const seated: ShopAccess = async () => true;

const facts = (overrides: Partial<HolderFacts>): HolderFacts => ({ heldRealmIds: [], ticket: null, ...overrides });

it("tells each holder level from what the account holds", () => {
  expect(holderLevelOf(facts({}))).toBe("none");
  expect(holderLevelOf(facts({ heldRealmIds: [PLAIN_REALM] }))).toBe("realm");
  expect(holderLevelOf(facts({ ticket: "regular" }))).toBe("realm");
  expect(holderLevelOf(facts({ heldRealmIds: [PLAIN_REALM, WONDER_REALM] }))).toBe("wonder");
  expect(holderLevelOf(facts({ ticket: "golden" }))).toBe("wonder");
  expect(holderLevelOf(facts({ heldRealmIds: [PLAIN_REALM], ticket: "golden" }))).toBe("wonder");
});

it("prices the seal by holder and channel, and says what each holder has free", () => {
  expect(sealOffer("none", "web")).toEqual({ cents: 1_000, free: { labor: false, fragments: false } });
  expect(sealOffer("none", "store")).toEqual({ cents: 999, free: { labor: false, fragments: false } });
  expect(sealOffer("realm", "store")).toEqual({ cents: 499, free: { labor: true, fragments: false } });
  expect(sealOffer("wonder", "web")).toEqual({ cents: 499, free: { labor: true, fragments: true } });
});

it("serves the signed-in account its level, whether it holds the seal, and the two prices", async () => {
  const db = await migrated();
  const auth = (realmsId: string | null) =>
    ({ api: { getSession: async () => (realmsId ? { user: { realmsId } } : null) } }) as unknown as IdentityAuth;
  const world = {
    db,
    access: seated,
    holderFacts: async () => facts({ ticket: "regular" }),
    readLordsPrice: marketDown,
  };
  const ask = (realmsId: string | null) =>
    handleSeal(new Request(`https://realms.test/api/shop/seal${GAME}`), auth(realmsId), world);
  expect((await ask(null)).status).toBe(401);
  expect(await (await ask(OWNER)).json()).toEqual({
    holder: "realm",
    owned: false,
    web: { cents: 499, free: { labor: true, fragments: false }, lords: null },
    store: { cents: 499, free: { labor: true, fragments: false } },
  });
  world.readLordsPrice = market(0.003637);
  expect(((await (await ask(OWNER)).json()) as { web: { lords: number } }).web.lords).toBe(1_375);
  await db
    .prepare(
      'INSERT INTO "seal" ("owner", "paid_cents", "source", "receipt", "granted_at") VALUES (?, 499, \'web\', \'tx-web\', 1)',
    )
    .bind(OWNER)
    .run();
  expect(await (await ask(OWNER)).json()).toEqual({ owned: true, web: null, store: null });
});

it("offers no price while holdings cannot be verified", async () => {
  const db = await migrated();
  const auth = { api: { getSession: async () => ({ user: { realmsId: OWNER } }) } } as unknown as IdentityAuth;
  const response = await handleSeal(new Request(`https://realms.test/api/shop/seal${GAME}`), auth, {
    db,
    access: seated,
    holderFacts: () => Promise.reject(new RealmHoldingsUnavailableError()),
    readLordsPrice: market(0.003637),
  });
  expect([response.status, await response.json()]).toEqual([503, { error: "holdings_unavailable" }]);
});

it("prices the web seal in LORDS from the market as it is asked, rounded up to 5, and from none while the market cannot be read", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const db = await migrated();
  const auth = { api: { getSession: async () => ({ user: { realmsId: OWNER } }) } } as unknown as IdentityAuth;
  const lords = async (holderFacts: HolderFacts, readLordsPrice: LordsPriceReader) =>
    (
      (await (
        await handleSeal(new Request(`https://realms.test/api/shop/seal${GAME}`), auth, {
          db,
          access: seated,
          holderFacts: async () => holderFacts,
          readLordsPrice,
        })
      ).json()) as { web: { lords: number | null } }
    ).web.lords;
  expect(await lords(facts({}), marketDown)).toBeNull();
  // $10 is 2,749.5 LORDS and $4.99 is 1,372.01: both round up to a multiple of 5.
  expect(await lords(facts({}), market(0.003637))).toBe(2_750);
  expect(await lords(facts({ heldRealmIds: [PLAIN_REALM] }), market(0.003637))).toBe(1_375);
  // Each ask reads the market again: the amount follows its price, and an outage leaves no old amount behind.
  expect(await lords(facts({}), market(0.005))).toBe(2_000);
  expect(await lords(facts({}), marketDown)).toBeNull();
});

it("offers the seal only to a player of a running Frontier game the request names", async () => {
  const db = await migrated();
  const auth = { api: { getSession: async () => ({ user: { realmsId: OWNER } }) } } as unknown as IdentityAuth;
  const ask = async (query: string, access: ShopAccess) => {
    const response = await handleSeal(new Request(`https://realms.test/api/shop/seal${query}`), auth, {
      db,
      access,
      holderFacts: async () => facts({ heldRealmIds: [PLAIN_REALM] }),
      readLordsPrice: market(0.003637),
    });
    return [response.status, await response.json()];
  };
  const outside = [404, { error: "no_shop_outside_a_frontier_game" }];
  expect(await ask(GAME, async () => false)).toEqual(outside);
  expect(await ask("", seated)).toEqual([400, { error: "invalid_game" }]);
  expect((await ask(GAME, seated))[0]).toBe(200);
});
