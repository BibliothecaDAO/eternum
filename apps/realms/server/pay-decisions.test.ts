import { Miniflare } from "miniflare";
import { beforeAll, afterAll, beforeEach, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { recordPayDecision, matchesPayDecision } from "./pay-decisions";
import { normalizeStarknetAddress } from "@realms-world/identity";
let mf: Miniflare, db: D1Database;
const wallet = normalizeStarknetAddress("0x10");
const decision = {
  chainId: "0x1",
  claimId: "0xabc",
  realmsId: "0x2",
  wallet,
  seasonId: 3,
  amount: "17",
  transactionHash: "0xdef",
};
beforeAll(async () => {
  mf = new Miniflare({ modules: true, script: "export default {}", d1Databases: ["DB"] });
  db = (await mf.getD1Database("DB")) as unknown as D1Database;
  await db.exec('CREATE TABLE "user" (id TEXT PRIMARY KEY, "realmsId" TEXT, address TEXT, "emailVerified" INTEGER)');
  for (const file of ["0012_wallet_link_history.sql", "0014_pay_decisions.sql"]) {
    let sql = readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8");
    if (file.startsWith("0012")) sql = sql.slice(0, sql.indexOf("INSERT INTO"));
    await db.batch(
      sql
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => db.prepare(s)),
    );
  }
});
afterAll(() => mf?.dispose());
beforeEach(async () => {
  await db.batch([
    db.prepare('DELETE FROM "user"'),
    db.prepare("DELETE FROM wallet_link_history"),
    db.prepare("DELETE FROM pay_decisions"),
  ]);
  await db.prepare("INSERT INTO \"user\" VALUES('u','0x2',?,1)").bind(wallet).run();
  await db
    .prepare("INSERT INTO wallet_link_history(id,account,wallet,linked_at,ready_at) VALUES(1,'0x2',?,0,0)")
    .bind(wallet)
    .run();
});
it("records ready evidence before broadcast and keeps it valid after unlink and inclusion-time skew", async () => {
  await recordPayDecision(db, decision);
  await db.prepare('UPDATE "user" SET address=NULL').run();
  await db.prepare("UPDATE wallet_link_history SET replaced_at=1").run();
  expect(await matchesPayDecision(db, decision)).toBe(true);
  for (const change of [
    { wallet: "0x20" },
    { transactionHash: "0xfee" },
    { claimId: "0xcab" },
    { amount: "18" },
    { realmsId: "0x3" },
  ])
    expect(await matchesPayDecision(db, { ...decision, ...change })).toBe(false);
});
it("refuses stale-wallet and held decisions before any transaction is broadcast", async () => {
  await db.prepare("UPDATE wallet_link_history SET ready_at=?").bind(Number.MAX_SAFE_INTEGER).run();
  await expect(recordPayDecision(db, decision)).rejects.toThrow();
  expect(await matchesPayDecision(db, decision)).toBe(false);
  await db.prepare("UPDATE wallet_link_history SET ready_at=0").run();
  await db.prepare('UPDATE "user" SET address=NULL').run();
  await expect(recordPayDecision(db, decision)).rejects.toThrow();
});
