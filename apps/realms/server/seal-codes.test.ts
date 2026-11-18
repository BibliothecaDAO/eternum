import { afterEach, expect, it, vi } from "vitest";

import type { IdentityAuth } from "./auth";
import { codeHashInScope } from "./campaigns";
import { handleSealCode, holdsSeal } from "./seal-codes";
import type { NamedGame } from "./shop-game";
import { createTestD1 } from "./test-d1";
import { migrationStatements } from "./workerd-harness";

const databases: { close(): Promise<void> }[] = [];
afterEach(async () => {
  for (const database of databases.splice(0)) await database.close();
});

const PLAYER = "0xa1";
const GAME: NamedGame = { chainId: "0x1", gameId: 7 };

const sealCodes = async (entered: NamedGame[]) => {
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
      .bind(await codeHashInScope("seal", code), "playtest")
      .run();
  const grantSeal = vi.fn(async (_game: NamedGame, _realmsId: string) => Response.json({}));
  const redeem = async (realmsId: string, code: string) => {
    const auth = { api: { getSession: async () => ({ user: { realmsId } }) } } as unknown as IdentityAuth;
    const request = new Request("https://realms.test/api/seal-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const response = await handleSealCode(request, auth, { db, enteredGames: async () => entered, grantSeal });
    return [response.status, await response.json()];
  };
  return { db, grantSeal, redeem };
};

it("grants a code redeemed in a running game at once, and again on a retry after the relay refused", async () => {
  const { grantSeal, redeem } = await sealCodes([GAME]);
  grantSeal.mockResolvedValueOnce(Response.json({ error: "seal_grant_unavailable" }, { status: 503 }));
  expect(await redeem(PLAYER, "CHARM234")).toEqual([503, { error: "seal_grant_unavailable" }]);
  expect(await redeem(PLAYER, "CHARM234")).toEqual([200, { held: true }]);
  expect(grantSeal.mock.calls).toEqual([
    [GAME, PLAYER],
    [GAME, PLAYER],
  ]);
});

it("holds a code redeemed before the season without a grant: entering the game grants it", async () => {
  const { db, grantSeal, redeem } = await sealCodes([]);
  expect(await redeem(PLAYER, "CHARM234")).toEqual([200, { held: true }]);
  expect(grantSeal).not.toHaveBeenCalled();
  expect(await holdsSeal(db, PLAYER)).toBe(true);
  expect(await holdsSeal(db, "0xb2")).toBe(false);
});

it("counts a bought Seal and a campaign ticket as a held Seal, and spends no code on either", async () => {
  const { db, grantSeal, redeem } = await sealCodes([GAME]);
  await db
    .prepare(
      `INSERT INTO "seal" ("owner", "paid_cents", "source", "receipt", "granted_at") VALUES (?, 999, 'store', 'tx-1', 1)`,
    )
    .bind("0xb2")
    .run();
  await db
    .prepare(
      `INSERT INTO "campaign_tickets" ("campaign", "owner", "code_hash", "tier", "redeemed_at") VALUES ('devcon-2026', ?, NULL, 'regular', 1)`,
    )
    .bind("0xc3")
    .run();
  expect([await holdsSeal(db, "0xb2"), await holdsSeal(db, "0xc3")]).toEqual([true, true]);
  expect(await redeem("0xb2", "CHARM234")).toEqual([409, { error: "seal_owned" }]);
  expect(await redeem("0xc3", "CHARM234")).toEqual([409, { error: "seal_owned" }]);
  expect(grantSeal).not.toHaveBeenCalled();
  expect(await redeem(PLAYER, "CHARM234")).toEqual([200, { held: true }]);
});
