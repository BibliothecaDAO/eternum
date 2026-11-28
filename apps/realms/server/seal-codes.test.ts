import { afterEach, expect, it, vi } from "vitest";

import type { IdentityAuth } from "./auth";
import { readSealCode, sealCodeHash } from "./public-codes";
import {
  deliverQueuedSealGrants,
  handleOperatorSealCodes,
  handleSealCode,
  holdsSeal,
  type SealCodeWorld,
} from "./seal-codes";
import type { EnteredGames, NamedGame } from "./shop-game";
import { createTestD1 } from "./test-d1";
import { migrationStatements } from "./workerd-harness";

const databases: { close(): Promise<void> }[] = [];
afterEach(async () => {
  for (const database of databases.splice(0)) await database.close();
});

const PLAYER = "0xa1";
const GAME: NamedGame = { chainId: "0x1", gameId: 7 };
const SECRET = "a-test-secret-with-at-least-thirty-two-bytes";

const sealCodes = async (entered: NamedGame[] | EnteredGames) => {
  const database = createTestD1();
  databases.push(database);
  const { db } = database;
  await db.batch(migrationStatements().map((sql) => db.prepare(sql)));
  for (const realmsId of [PLAYER, "0xb2", "0xc3"])
    await db
      .prepare(
        `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt", "realmsId")
         VALUES (?1, ?1, ?1 || '@realms.test', 1, 1, 1, ?1)`,
      )
      .bind(realmsId)
      .run();
  for (const code of ["CHARM234", "BRAVE234"])
    await db
      .prepare('INSERT INTO "seal_codes" ("code_hash", "label") VALUES (?, ?)')
      .bind(await sealCodeHash(code), "playtest")
      .run();
  const grantSeal = vi.fn(async (_game: NamedGame, _realmsId: string) => Response.json({}));
  const world: SealCodeWorld = {
    db,
    enteredGames: typeof entered === "function" ? entered : async () => entered,
    grantSeal,
  };
  const redeem = async (realmsId: string, code: string) => {
    const auth = { api: { getSession: async () => ({ user: { realmsId } }) } } as unknown as IdentityAuth;
    const request = new Request("https://realms.test/api/seal-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const response = await handleSealCode(request, auth, world);
    return [response.status, await response.json()];
  };
  const queued = async () => (await db.prepare('SELECT "owner" FROM "seal_grants"').all()).results;
  return { db, grantSeal, redeem, world, queued };
};

it("grants a code redeemed in a running game at once, and a grant the relay refused on the next cron, once", async () => {
  const { grantSeal, redeem, world, queued } = await sealCodes([GAME]);
  grantSeal.mockResolvedValueOnce(Response.json({ error: "seal_grant_unavailable" }, { status: 503 }));
  expect(await redeem(PLAYER, "CHARM234")).toEqual([200, { held: true }]);
  expect(await queued()).toEqual([{ owner: PLAYER }]);
  await deliverQueuedSealGrants(world);
  await deliverQueuedSealGrants(world);
  expect(grantSeal.mock.calls).toEqual([
    [GAME, PLAYER],
    [GAME, PLAYER],
  ]);
  expect(await queued()).toEqual([]);
});

it("keeps a held code's grant queued while a shard cannot say which games the account entered", async () => {
  const entered = vi
    .fn<EnteredGames>()
    .mockRejectedValueOnce(new Error("games directory answered 503"))
    .mockRejectedValueOnce(new Error("games directory answered 503"))
    .mockResolvedValue([GAME]);
  const { grantSeal, redeem, world, queued } = await sealCodes(entered);
  expect(await redeem(PLAYER, "CHARM234")).toEqual([200, { held: true }]);
  await deliverQueuedSealGrants(world);
  expect(grantSeal).not.toHaveBeenCalled();
  expect(await queued()).toEqual([{ owner: PLAYER }]);
  await deliverQueuedSealGrants(world);
  expect(grantSeal.mock.calls).toEqual([[GAME, PLAYER]]);
  expect(await queued()).toEqual([]);
});

it("holds a code redeemed before the season without a grant: entering the game grants it", async () => {
  const { db, grantSeal, redeem } = await sealCodes([]);
  expect(await redeem(PLAYER, "CHARM234")).toEqual([200, { held: true }]);
  expect(grantSeal).not.toHaveBeenCalled();
  expect(await holdsSeal(db, PLAYER)).toBe(true);
  expect(await holdsSeal(db, "0xb2")).toBe(false);
});

it("mints idempotent operator batches of 1..200 formatted codes, stores only SHA-256 hashes, and redeems formatted codes once", async () => {
  const { db, redeem } = await sealCodes([]);
  const baseNow = Math.floor(Date.now() / 1000);
  const now = () => baseNow;
  const postBatch = (body: unknown, contentType = "application/json") =>
    handleOperatorSealCodes(
      new Request("https://realms.test/api/operator/seal-codes", {
        method: "POST",
        headers: { "content-type": contentType },
        body: JSON.stringify(body),
      }),
      db,
      SECRET,
      now,
    );

  const created = await postBatch({ label: "airdrop-wave-1", count: 3, expiresAt: now() + 3600 });
  expect(created.status).toBe(201);
  expect(created.headers.get("cache-control")).toBe("no-store");
  const payload = (await created.json()) as {
    label: string;
    expiresAt: number | null;
    codes: string[];
  };
  expect(payload.label).toBe("airdrop-wave-1");
  expect(payload.expiresAt).toBe(now() + 3600);
  expect(payload.codes).toHaveLength(3);
  expect(new Set(payload.codes).size).toBe(3);

  const retried = await postBatch({ label: "airdrop-wave-1", count: 3, expiresAt: now() + 3600 });
  expect(retried.status).toBe(201);
  expect(await retried.json()).toEqual(payload);

  const expanded = await postBatch({ label: "airdrop-wave-1", count: 5, expiresAt: now() + 3600 });
  expect(expanded.status).toBe(201);
  const expandedPayload = (await expanded.json()) as { codes: string[] };
  expect(expandedPayload.codes.slice(0, 3)).toEqual(payload.codes);
  expect(new Set(expandedPayload.codes).size).toBe(5);

  const conflictingExpiry = await postBatch({ label: "airdrop-wave-1", count: 3, expiresAt: now() + 7200 });
  expect([conflictingExpiry.status, await conflictingExpiry.json()]).toEqual([409, { error: "label_expiry_mismatch" }]);

  const rotatedKeyRetry = await handleOperatorSealCodes(
    new Request("https://realms.test/api/operator/seal-codes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "airdrop-wave-1", count: 5, expiresAt: now() + 3600 }),
    }),
    db,
    "rotated-operator-secret-after-incident",
    now,
  );
  expect([rotatedKeyRetry.status, await rotatedKeyRetry.json()]).toEqual([409, { error: "label_key_mismatch" }]);
  const countAfterRotation = await db
    .prepare('SELECT COUNT(*) AS "n" FROM "seal_codes" WHERE "label" = ?1')
    .bind("airdrop-wave-1")
    .first<{ n: number }>();
  expect(Number(countAfterRotation?.n)).toBe(5);

  const otherLabel = await postBatch({ label: "airdrop-wave-2", count: 3, expiresAt: now() + 3600 });
  const otherCodes = ((await otherLabel.json()) as { codes: string[] }).codes;
  expect(otherCodes.some((code) => payload.codes.includes(code))).toBe(false);

  for (const formatted of expandedPayload.codes) {
    expect(formatted).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const canonical = readSealCode(formatted);
    expect(canonical).not.toBeNull();
    const stored = await db
      .prepare('SELECT "code_hash", "label", "expires_at" FROM "seal_codes" WHERE "code_hash" = ?1')
      .bind(await sealCodeHash(canonical!))
      .first<{ code_hash: string; label: string; expires_at: number | null }>();
    expect(stored).toEqual({
      code_hash: await sealCodeHash(canonical!),
      label: "airdrop-wave-1",
      expires_at: now() + 3600,
    });
  }

  const allRowsText = JSON.stringify((await db.prepare('SELECT * FROM "seal_codes"').all()).results);
  for (const formatted of expandedPayload.codes) {
    expect(allRowsText).not.toContain(formatted);
    expect(allRowsText).not.toContain(formatted.replace("-", ""));
  }

  expect(await redeem(PLAYER, payload.codes[0]!)).toEqual([200, { held: true }]);
  expect(await redeem("0xb2", payload.codes[0]!)).toEqual([410, { error: "code_unavailable" }]);
  expect(await redeem("0xb2", payload.codes[1]!.toLowerCase().replace("-", ""))).toEqual([200, { held: true }]);

  const maxBatch = await postBatch({ label: "giveaway-max", count: 200 });
  expect(maxBatch.status).toBe(201);
  expect(((await maxBatch.json()) as { codes: string[] }).codes).toHaveLength(200);

  expect((await postBatch({ label: "bad", count: 0 })).status).toBe(400);
  expect((await postBatch({ label: "bad", count: 201 })).status).toBe(400);
  expect((await postBatch({ label: "bad", count: 1.5 })).status).toBe(400);
  expect((await postBatch({ label: "BAD LABEL!", count: 1 })).status).toBe(400);
  expect((await postBatch({ label: "past-exp", count: 1, expiresAt: now() })).status).toBe(400);
  expect((await postBatch({ label: "plain", count: 1 }, "text/plain")).status).toBe(415);
  expect(
    (
      await handleOperatorSealCodes(
        new Request("https://realms.test/api/operator/seal-codes", { method: "DELETE" }),
        db,
        SECRET,
      )
    ).status,
  ).toBe(405);
});

it("summarizes issued, redeemed, remaining, and expired seal codes grouped by label", async () => {
  const { db, redeem } = await sealCodes([]);
  const baseNow = Math.floor(Date.now() / 1000);
  const now = () => baseNow;
  await db
    .prepare('INSERT INTO "seal_codes" ("code_hash", "label", "expires_at") VALUES (?1, ?2, ?3)')
    .bind(await sealCodeHash("EXPD2345"), "playtest", now() - 10)
    .run();
  const minted = await handleOperatorSealCodes(
    new Request("https://realms.test/api/operator/seal-codes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "creators", count: 2, expiresAt: now() + 500 }),
    }),
    db,
    SECRET,
    now,
  );
  const { codes } = (await minted.json()) as { codes: string[] };
  expect(await redeem(PLAYER, codes[0]!)).toEqual([200, { held: true }]);
  expect(await redeem("0xb2", "CHARM234")).toEqual([200, { held: true }]);

  const summary = await handleOperatorSealCodes(
    new Request("https://realms.test/api/operator/seal-codes", { method: "GET" }),
    db,
    SECRET,
    now,
  );
  expect(summary.status).toBe(200);
  expect(await summary.json()).toEqual({
    labels: [
      { label: "creators", issued: 2, redeemed: 1, remaining: 1, expired: 0 },
      { label: "playtest", issued: 3, redeemed: 1, remaining: 1, expired: 1 },
    ],
  });
});
