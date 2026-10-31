import { Miniflare } from "miniflare";
import { beforeAll, afterAll, beforeEach, expect, it } from "vitest";
import { disposeWorker } from "../../../packages/value-ledger/test-support/workerd";
import { readPayoutIdentity } from "./payout-identity";
import { routeIdentityRequest } from "./routes";
import type { IdentityEnv } from "./env";
let mf: Miniflare, db: D1Database;
beforeAll(async () => {
  mf = new Miniflare({ modules: true, script: "export default {}", d1Databases: ["DB"] });
  db = (await mf.getD1Database("DB")) as unknown as D1Database;
  await db.exec(
    'CREATE TABLE "user" ("realmsId" TEXT PRIMARY KEY, address TEXT, "emailVerified" INTEGER); CREATE TABLE realms_accounts (address TEXT PRIMARY KEY, "realmsId" TEXT)',
  );
});
afterAll(() => disposeWorker(mf));
beforeEach(async () => {
  await db.batch([
    db.prepare('DELETE FROM "user"'),
    db.prepare("DELETE FROM realms_accounts"),
    db.prepare('INSERT INTO "user" VALUES (?, ?, 1)').bind("0x1", "0x123"),
    db.prepare("INSERT INTO realms_accounts VALUES (?, ?)").bind("0x456", "0x1"),
  ]);
});
it("resolves only the receipt account's current verified wallet and follows replacement or unlink", async () => {
  expect(await readPayoutIdentity(db, "0x0456")).toEqual({ realmsId: "0x1", wallet: "0x123" });
  expect(await readPayoutIdentity(db, "0x999")).toBeNull();
  await db.prepare('UPDATE "user" SET address=?').bind("0x789").run();
  expect(await readPayoutIdentity(db, "0x456")).toEqual({ realmsId: "0x1", wallet: "0x789" });
  await db.prepare('UPDATE "user" SET "emailVerified"=0').run();
  expect(await readPayoutIdentity(db, "0x456")).toBeNull();
  await db.prepare('UPDATE "user" SET "emailVerified"=1,address=NULL').run();
  expect(await readPayoutIdentity(db, "0x456")).toBeNull();
});
it("authenticates the co-signer read route and never caches the wallet", async () => {
  const env = { DB: db, OPERATOR_TOKEN: "read-token", BASE_URL: "https://identity.test" } as IdentityEnv;
  const route = (request: Request) =>
    routeIdentityRequest(
      request,
      env,
      {} as Parameters<typeof routeIdentityRequest>[2],
      {} as Parameters<typeof routeIdentityRequest>[3],
    );
  const url = "https://identity.test/api/operator/payout-identity?account=0x456";
  expect((await route(new Request(url))).status).toBe(401);
  const response = await route(new Request(url, { headers: { authorization: "Bearer read-token" } }));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ identity: { realmsId: "0x1", wallet: "0x123" } });
});
