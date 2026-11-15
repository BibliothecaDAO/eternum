import { afterEach, expect, it } from "vitest";

import type { IdentityAuth } from "./auth";
import { handleSeal, holderLevelOf, sealOffer, type HolderFacts } from "./seal";
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
  const world = { db, holderFacts: async () => facts({ ticket: "regular" }) };
  const ask = (realmsId: string | null) =>
    handleSeal(new Request("https://realms.test/api/shop/seal"), auth(realmsId), world);
  expect((await ask(null)).status).toBe(401);
  expect(await (await ask(OWNER)).json()).toEqual({
    holder: "realm",
    owned: false,
    web: { cents: 499, free: { labor: true, fragments: false } },
    store: { cents: 499, free: { labor: true, fragments: false } },
  });
  await db
    .prepare(
      'INSERT INTO "seal" ("owner", "paid_cents", "source", "receipt", "granted_at") VALUES (?, 499, \'web\', \'tx-web\', 1)',
    )
    .bind(OWNER)
    .run();
  expect(((await (await ask(OWNER)).json()) as { owned: boolean }).owned).toBe(true);
});
