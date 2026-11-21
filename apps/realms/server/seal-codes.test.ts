import { afterEach, expect, it, vi } from "vitest";

import type { IdentityAuth } from "./auth";
import { sealCodeHash } from "./public-codes";
import { deliverQueuedSealGrants, handleSealCode, holdsSeal, type SealCodeWorld } from "./seal-codes";
import type { EnteredGames, NamedGame } from "./shop-game";
import { createTestD1 } from "./test-d1";
import { migrationStatements } from "./workerd-harness";

const databases: { close(): Promise<void> }[] = [];
afterEach(async () => {
  for (const database of databases.splice(0)) await database.close();
});

const PLAYER = "0xa1";
const GAME: NamedGame = { chainId: "0x1", gameId: 7 };

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

