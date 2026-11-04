import { disposeWorker } from "../../../packages/value-ledger/test-support/workerd";
import { Miniflare } from "miniflare";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { sendRecord, type Delivery } from "./comeback-campaign";

let mf: Miniflare;
let db: D1Database;
const CAMPAIGN = "comeback";
const a: Delivery = { realmsId: "0xa", variant: "D" };
const b: Delivery = { realmsId: "0xb", variant: "N" };

beforeAll(async () => {
  mf = new Miniflare({ modules: true, script: "export default {}", d1Databases: ["DB"] });
  db = (await mf.getD1Database("DB")) as unknown as D1Database;
  await db.exec('CREATE TABLE "user" ("id" TEXT PRIMARY KEY, "realmsId" TEXT UNIQUE)');
  const migration = readFileSync(new URL("../migrations/0025_news_email.sql", import.meta.url), "utf8");
  const statements = migration
    .replace(/--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
  await db.batch(statements.map((statement) => db.prepare(statement)));
});
afterAll(() => disposeWorker(mf));
beforeEach(async () => {
  await db.batch([
    db.prepare("DELETE FROM news_email_sends"),
    db.prepare('DELETE FROM "user"'),
    db.prepare(`INSERT INTO "user" ("id", "realmsId") VALUES ('a', '0xa'), ('b', '0xb')`),
  ]);
});

const run = async (sql: string) => (await db.prepare(sql).all()).results;
const rows = () => run(`SELECT realmsId, status, resend_id FROM news_email_sends ORDER BY realmsId`);

it("reserves an account once: a second reservation, from a rerun or a parallel run, wins nothing", async () => {
  expect(await run(sendRecord.reserve(CAMPAIGN, a, 1))).toEqual([{ realmsId: "0xa" }]);
  expect(await run(sendRecord.reserve(CAMPAIGN, a, 2))).toEqual([]);
  expect(await rows()).toEqual([{ realmsId: "0xa", status: "reserved", resend_id: null }]);
});

it("reserves nothing for an account that stopped news emails", async () => {
  await run(`UPDATE "user" SET newsEmailOptOutAt = 5 WHERE realmsId = '0xb'`);
  expect(await run(sendRecord.reserve(CAMPAIGN, b, 1))).toEqual([]);
  expect(await run(sendRecord.optedOut(b))).toEqual([{ newsEmailOptOutAt: 5 }]);
  expect(await rows()).toEqual([]);
});

it("marks a sent email with its receipt, and frees only a reservation that was never sent", async () => {
  await run(sendRecord.reserve(CAMPAIGN, a, 1));
  await run(sendRecord.reserve(CAMPAIGN, b, 1));
  await run(sendRecord.markSent(CAMPAIGN, a, "01a1a5da-d734-7160", 2));
  await run(sendRecord.release(CAMPAIGN, a));
  await run(sendRecord.release(CAMPAIGN, b));
  expect(await rows()).toEqual([{ realmsId: "0xa", status: "sent", resend_id: "01a1a5da-d734-7160" }]);
});

it("refuses anything but an account id in a statement", () => {
  expect(() => sendRecord.reserve(CAMPAIGN, { realmsId: "0xa' OR 1=1 --", variant: "D" }, 1)).toThrow(
    "unexpected account id",
  );
});
