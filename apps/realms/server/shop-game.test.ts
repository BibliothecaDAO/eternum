import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { realmsAccountAddress } from "@realms-world/identity/account";

import { nativeCommandBits } from "../../../contracts/l3/world-native/schema/commands.gen";
import { readEnrolledAccounts, readGameFacts } from "./day-open";
import { ACCOUNT_CLASS_HASH, type IdentityEnv } from "./env";
import { enteredGamesOf, namedGame, shopAccessOf } from "./shop-game";
import { createTestD1 } from "./test-d1";
import { migrationStatements } from "./workerd-harness";

vi.mock("./day-open", async (original) => ({
  ...(await original<typeof import("./day-open")>()),
  readEnrolledAccounts: vi.fn(),
  readGameFacts: vi.fn(),
}));

/** The shop's rule, read from a shard's games directory and its confirmed enrollment. Times are seconds. */
const CHAIN = "0x1";
const GUARDIAN_KEY = "0x123";
const UNIT = 7_200;
const START = 1_900_000_000;
const calendar = {
  seed: 0x5eedn,
  startMainAt: START,
  scheduledEndAt: START + 40 * UNIT,
  endAt: START + 40 * UNIT,
  dayUnitSeconds: UNIT,
};
const gameOf = (id: number, status = "Live", mode = "frontier") => ({
  game_id: id,
  mode,
  status,
  clock: { start_main_at: START, scheduled_end_at: calendar.scheduledEndAt, end_at: calendar.endAt },
  expedition: { seed: calendar.seed.toString(), day_unit_seconds: UNIT },
});
const NOW = START + UNIT * 4;
const SEASON_ONE_SPENDS = BigInt(nativeCommandBits.BuySeal) | BigInt(nativeCommandBits.BuyStamina);
const accountOf = (realmsId: string) => realmsAccountAddress(realmsId, ACCOUNT_CLASS_HASH, GUARDIAN_KEY);

const databases: { close(): Promise<void> }[] = [];
beforeEach(() => {
  vi.mocked(readEnrolledAccounts).mockReset();
  vi.mocked(readGameFacts).mockReset();
});
afterEach(async () => {
  for (const database of databases.splice(0)) await database.close();
});

const envOn = async (games: unknown[], enrolled: string[] | Error, commandMask = SEASON_ONE_SPENDS) => {
  const database = createTestD1();
  databases.push(database);
  await database.db.batch(migrationStatements().map((sql) => database.db.prepare(sql)));
  await database.db
    .prepare(`INSERT INTO "shards" ("slot", "url", "chainId") VALUES (1, 'https://shard.test', '${CHAIN}')`)
    .run();
  vi.mocked(readEnrolledAccounts).mockImplementation(async () => {
    if (enrolled instanceof Error) throw enrolled;
    return enrolled;
  });
  vi.mocked(readGameFacts).mockImplementation(async () => {
    if (enrolled instanceof Error) throw enrolled;
    return {
      require: () => ({ command_mask: commandMask }),
      inGame: () => enrolled.map((owner) => ({ owner: BigInt(owner) })),
    } as never;
  });
  const fetchShard = (async () => Response.json({ chain: CHAIN, games })) as typeof fetch;
  const env = { DB: database.db, GUARDIAN: { publicKey: async () => GUARDIAN_KEY } } as unknown as IdentityEnv;
  return { env, fetchShard };
};

const shopOn = async (games: unknown[], enrolled: string[] | Error, commandMask = SEASON_ONE_SPENDS) => {
  const { env, fetchShard } = await envOn(games, enrolled, commandMask);
  return shopAccessOf(env, fetchShard, () => NOW);
};

it("lists every running Frontier game the account is enrolled in, and none it is not", async () => {
  const { env, fetchShard } = await envOn(
    [gameOf(1), gameOf(2), gameOf(3, "Ended"), gameOf(4, "Live", "blitz")],
    [accountOf("0xa1")],
  );
  const entered = enteredGamesOf(env, fetchShard, () => NOW);
  expect(await entered("0xa1")).toEqual([
    { chainId: CHAIN, gameId: 1 },
    { chainId: CHAIN, gameId: 2 },
  ]);
  expect(await entered("0xb2")).toEqual([]);
});

it("lists a Frontier game the account entered before its first day, and none that has ended", async () => {
  const settling = { ...gameOf(5), clock: { ...gameOf(5).clock, start_main_at: NOW + UNIT } };
  const ended = { ...gameOf(6), clock: { ...gameOf(6).clock, end_at: NOW - 1 } };
  const { env, fetchShard } = await envOn([settling, ended], [accountOf("0xa1")]);
  expect(await enteredGamesOf(env, fetchShard, () => NOW)("0xa1")).toEqual([{ chainId: CHAIN, gameId: 5 }]);
});

it("seats an enrolled player of a running Frontier game", async () => {
  const access = await shopOn([gameOf(1)], [accountOf("0xa1")]);
  expect(await access("0xa1", { chainId: CHAIN, gameId: 1 })).toBe(true);
  expect(readGameFacts).toHaveBeenCalledWith("https://shard.test", 1, ["PlayerEntry", "SliceRules"]);
});

it("opens no shop in a game whose rules take no Fragment spend, and opens it once one spend is on", async () => {
  expect(await (await shopOn([gameOf(1)], [accountOf("0xa1")], 0n))("0xa1", { chainId: CHAIN, gameId: 1 })).toBe(false);
  const reroll = BigInt(nativeCommandBits.RerollOath);
  expect(await (await shopOn([gameOf(1)], [accountOf("0xa1")], reroll))("0xa1", { chainId: CHAIN, gameId: 1 })).toBe(
    true,
  );
});

it("seats no one who is not enrolled in that game, and no one in a game that does not run", async () => {
  const access = await shopOn([gameOf(1), gameOf(2, "Ended"), gameOf(3, "Live", "blitz")], [accountOf("0xa1")]);
  expect(await access("0xb2", { chainId: CHAIN, gameId: 1 })).toBe(false);
  for (const gameId of [2, 3, 9]) expect(await access("0xa1", { chainId: CHAIN, gameId })).toBe(false);
  expect(await access("0xa1", { chainId: "0x2", gameId: 1 })).toBe(false);
});

it("throws while the shard's enrollment cannot be read, never seating on a guess", async () => {
  const access = await shopOn([gameOf(1)], new Error("Herald 503"));
  await expect(access("0xa1", { chainId: CHAIN, gameId: 1 })).rejects.toThrow("Herald 503");
});

it("names a game by its chain and a positive whole id, or by nothing", () => {
  expect(namedGame("0x01", "7")).toEqual({ chainId: "0x1", gameId: 7 });
  expect(namedGame("0x1", 7)).toEqual({ chainId: "0x1", gameId: 7 });
  for (const [chain, game] of [
    [null, "1"],
    ["0x1", null],
    ["0x1", "0"],
    ["0x1", "zero"],
    ["0x1", true],
    ["not hex", "1"],
  ])
    expect(namedGame(chain, game)).toBeNull();
});
