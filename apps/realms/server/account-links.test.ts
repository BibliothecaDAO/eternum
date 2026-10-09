import { readFileSync } from "node:fs";
import { Miniflare } from "miniflare";
import { beforeAll, afterAll, beforeEach, expect, it } from "vitest";
import { normalizeStarknetAddress } from "@realms-world/identity";
import { realmsAccountAddress } from "@realms-world/identity/account";
import { accountLinkTarget, accountLinkTargets, recordLedgerLinkWrite, matchesLedgerLinkWrite } from "./account-links";
let mf: Miniflare, db: D1Database;
const pins = { accountClassHash: "0x2", guardianPublicKey: "0x3" };
const wallet = normalizeStarknetAddress("0x10");
const account = realmsAccountAddress("0x1", pins.accountClassHash, pins.guardianPublicKey);
beforeAll(async () => {
  mf = new Miniflare({ modules: true, script: "export default {}", d1Databases: ["DB"] });
  db = (await mf.getD1Database("DB")) as unknown as D1Database;
  await db.exec('CREATE TABLE "user" (id TEXT PRIMARY KEY, "realmsId" TEXT, address TEXT, "emailVerified" INTEGER)');
  for (const file of ["0012_wallet_link_history.sql", "0013_ledger_link_writes.sql"]) {
    let sql = readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8");
    if (file.startsWith("0012")) sql = sql.slice(0, sql.indexOf("INSERT INTO"));
    await db.batch(
      sql
        .split(";")
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => db.prepare(x)),
    );
  }
});
afterAll(() => mf?.dispose());
beforeEach(async () => {
  await db.batch([
    db.prepare('DELETE FROM "user"'),
    db.prepare("DELETE FROM wallet_link_history"),
    db.prepare("DELETE FROM ledger_link_writes"),
  ]);
  await db.prepare("INSERT INTO \"user\" VALUES('u','0x1',?,1)").bind(wallet).run();
  await db
    .prepare("INSERT INTO wallet_link_history(id,account,wallet,linked_at,ready_at) VALUES(1,'0x1',?,1000,86401000)")
    .bind(wallet)
    .run();
});
it("enumerates current links immediately without a hold and retains former wallets for cleanup", async () => {
  expect((await accountLinkTargets(db, pins, null)).rows).toContainEqual({
    key: "account:0x1",
    realmsId: "0x1",
    wallet,
    account,
    historyId: 1,
  });
  await db.prepare('UPDATE "user" SET address=NULL').run();
  await db.prepare("UPDATE wallet_link_history SET replaced_at=2000").run();
  const page = await accountLinkTargets(db, pins, null);
  expect(page.rows).toContainEqual({ key: "account:0x1", realmsId: "0x1", wallet: null, account, historyId: 1 });
  expect(page.rows).toContainEqual({ key: "wallet:" + wallet, realmsId: "0x1", wallet, account: null, historyId: 1 });
});
it("checks the signed intent and authority after later unlink, after later unlink", async () => {
  const target = await accountLinkTarget(db, pins, "account:0x1");
  const write = { transactionHash: "0xabc", wallet, account, previousAccount: "0x0", previousWallet: "0x0" };
  await recordLedgerLinkWrite(db, pins, target, write);
  await db.prepare('UPDATE "user" SET address=NULL').run();
  await db.prepare("UPDATE wallet_link_history SET replaced_at=2000").run();
  expect(await matchesLedgerLinkWrite(db, pins, write)).toBe(true);
  for (const change of [{ account: "0x999" }, { wallet: "0x999" }])
    expect(await matchesLedgerLinkWrite(db, pins, { ...write, ...change })).toBe(false);
  expect(await matchesLedgerLinkWrite(db, pins, { ...write, transactionHash: "0xdef" })).toBe(false);
  expect(await matchesLedgerLinkWrite(db, pins, { ...write, wallet: "0x999", transactionHash: "0xdef" })).toBe(false);
});
it("cannot authorize an arbitrary account or a clear the identity never requested", async () => {
  const target = await accountLinkTarget(db, pins, "account:0x1");
  await expect(
    recordLedgerLinkWrite(db, pins, target, {
      transactionHash: "0xabc",
      wallet,
      account: "0x999",
      previousAccount: "0x0",
      previousWallet: "0x0",
    }),
  ).rejects.toThrow();
  await expect(
    recordLedgerLinkWrite(
      db,
      pins,
      { ...target, wallet: null },
      { transactionHash: "0xabc", wallet, account: "0x0", previousAccount: account, previousWallet: "0x0" },
    ),
  ).rejects.toThrow();
});
it("returns one bounded cursor page for large histories", async () => {
  await db.batch(
    Array.from({ length: 40 }, (_, i) =>
      db.prepare('INSERT INTO "user" VALUES(?,?,NULL,1)').bind("u" + i, "0x" + (i + 2).toString(16)),
    ),
  );
  await db.batch(
    Array.from({ length: 40 }, (_, i) =>
      db
        .prepare("INSERT INTO wallet_link_history(account,wallet,replaced_at) VALUES(?,?,2000)")
        .bind("0x1", "0x" + (i + 100).toString(16)),
    ),
  );
  const page = await accountLinkTargets(db, pins, null);
  expect(page.rows).toHaveLength(25);
  expect(page.next).not.toBeNull();
  const next = await accountLinkTargets(db, pins, page.next);
  expect(next.rows.length).toBeGreaterThan(0);
  expect(next.rows.some((row) => !page.rows.some((old) => old.key === row.key))).toBe(true);
});

it("matches authorized set and clear intents when earlier pending writes change displacement fields", async () => {
  const target = await accountLinkTarget(db, pins, "account:0x1");
  const write = { transactionHash: "0xabc", wallet, account, previousAccount: "0x0", previousWallet: "0x0" };
  await recordLedgerLinkWrite(db, pins, target, write);
  expect(await matchesLedgerLinkWrite(db, pins, { ...write, previousAccount: "0x999", previousWallet: "0x888" })).toBe(
    true,
  );
  await db.prepare('UPDATE "user" SET address=NULL').run();
  await db.prepare("UPDATE wallet_link_history SET replaced_at=2000").run();
  const cleared = await accountLinkTarget(db, pins, "account:0x1");
  const clear = { ...write, transactionHash: "0xdef", account: "0x0", previousAccount: account };
  await recordLedgerLinkWrite(db, pins, cleared, clear);
  expect(await matchesLedgerLinkWrite(db, pins, { ...clear, previousAccount: "0x777" })).toBe(true);
});
