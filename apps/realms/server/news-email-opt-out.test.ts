import { disposeWorker } from "../../../packages/value-ledger/test-support/workerd";
import { Miniflare } from "miniflare";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import type { IdentityAuth } from "./auth";
import type { IdentityEnv } from "./env";
import { newsEmailOptOutLink } from "./news-email-opt-out";
import { routeIdentityRequest } from "./routes";

const ORIGIN = "https://play.realms.party";
const SECRET = "auth-secret";
let mf: Miniflare;
let db: D1Database;
let env: IdentityEnv;

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
  env = { BASE_URL: ORIGIN, BETTER_AUTH_SECRET: SECRET, DB: db } as unknown as IdentityEnv;
});
afterAll(() => disposeWorker(mf));
beforeEach(async () => {
  await db.batch([
    db.prepare('DELETE FROM "user"'),
    db.prepare(`INSERT INTO "user" ("id", "realmsId") VALUES ('a', '0xa'), ('b', '0xb')`),
  ]);
});

const open = (url: string, init?: RequestInit) =>
  routeIdentityRequest(
    new Request(url, init),
    env,
    {} as IdentityAuth,
    {} as Parameters<typeof routeIdentityRequest>[3],
  );
const optedOutAt = async (realmsId: string) =>
  (await db
    .prepare(`SELECT "newsEmailOptOutAt" AS at FROM "user" WHERE "realmsId" = ?1`)
    .bind(realmsId)
    .first<{ at: number | null }>())!.at;
/** What a mail client sends for one-click unsubscribe (RFC 8058): a POST with no Origin or cookie. */
const oneClick = {
  method: "POST",
  body: "List-Unsubscribe=One-Click",
  headers: { "content-type": "application/x-www-form-urlencoded" },
};

it("asks first on a GET, so a mail scanner opening the link stops nothing", async () => {
  const response = await open(await newsEmailOptOutLink(ORIGIN, SECRET, "0xa"));
  expect(response.status).toBe(200);
  expect(await response.text()).toContain("Stop these emails</button>");
  expect(await optedOutAt("0xa")).toBeNull();
});

it("stops the account's news emails on a one-click POST, and a second click keeps the first time", async () => {
  const link = await newsEmailOptOutLink(ORIGIN, SECRET, "0xa");
  expect(new URL(link).pathname).toBe("/api/email/opt-out");
  const response = await open(link, oneClick);
  expect(response.status).toBe(200);
  expect(await response.text()).toContain("You won't get Realms news emails");
  const first = await optedOutAt("0xa");
  expect(first).toBeGreaterThan(0);
  await open(link, oneClick);
  expect(await optedOutAt("0xa")).toBe(first);
  expect(await optedOutAt("0xb")).toBeNull();
});

it("refuses a link signed for another account, with another secret, or altered", async () => {
  const forA = new URL(await newsEmailOptOutLink(ORIGIN, SECRET, "0xa"));
  const otherAccount = new URL(forA);
  otherAccount.searchParams.set("u", "0xb");
  const otherSecret = await newsEmailOptOutLink(ORIGIN, "another-secret", "0xb");
  const altered = new URL(forA);
  const token = forA.searchParams.get("t")!;
  altered.searchParams.set("t", `${token[0] === "A" ? "B" : "A"}${token.slice(1)}`);
  for (const link of [otherAccount.toString(), otherSecret, altered.toString(), `${ORIGIN}/api/email/opt-out?u=0xb`]) {
    const response = await open(link, oneClick);
    expect(response.status).toBe(403);
  }
  expect(await optedOutAt("0xa")).toBeNull();
  expect(await optedOutAt("0xb")).toBeNull();
});
