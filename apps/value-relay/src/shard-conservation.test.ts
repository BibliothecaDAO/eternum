import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { shardConservationPort } from "./shard-conservation";
import { runMonitor, type MonitorProgress } from "./monitor";
import type { ConfirmedSnapshot } from "./shard-snapshot";
import { RelayFailure, type MonitorPorts } from "./ports";

const rpc = vi.hoisted(() => ({ chain: vi.fn(), block: vi.fn() }));
vi.mock("./rpc", () => ({ rpcAt: () => ({ getChainId: rpc.chain, getBlock: rpc.block }) }));
const connection = { chainId: "0x1", gamesAddress: "0x10", rpcUrl: "https://shard.test/rpc" };
const directory = () => ({
  chain: "0x1",
  world_address: "0x10",
  confirmed_block: 10,
  games: [
    { game_id: 7, preset_id: 5, mode: "frontier" },
    { game_id: 8, preset_id: 2, mode: "blitz" },
  ],
});
const snapshot = (poolLeft = "83", amount = "17"): ConfirmedSnapshot => ({
  game_id: "7",
  confirmed_block: 10,
  models: [
    {
      model: "ChestRules",
      rows: [{ key: "7", value: { game_id: 7, pool: "100", price_ceiling: "10", shares: {}, estimate_days: 5 } }],
    },
    {
      model: "LordsBudget",
      rows: [
        {
          key: "7",
          value: {
            game_id: 7,
            pool_left: poolLeft,
            open: "3",
            day: "1",
            price: "1",
            estimate: "20",
            rolled_shares: "4",
          },
        },
      ],
    },
    {
      model: "LordsWithdrawal",
      rows: [{ key: "7:0xabc", value: { game_id: 7, claim_id: "0xabc", account: "0x123", amount } }],
    },
  ],
});
const network = (body = snapshot(), games = directory()) =>
  vi.fn(async (url: URL | RequestInfo) => Response.json(new URL(String(url)).pathname === "/games" ? games : body));
beforeEach(() => {
  vi.clearAllMocks();
  rpc.chain.mockResolvedValue("0x1");
  rpc.block.mockImplementation(async (height) => ({
    block_number: height === "latest" ? 10 : height,
    block_hash: "0xa",
    parent_hash: "0x9",
    timestamp: 1000,
    status: "ACCEPTED_ON_L2",
  }));
});
it("uses one confirmed budget and the sum of immutable receipts in whole LORDS, without counting open reservations", async () => {
  const read = network();
  expect(await Effect.runPromise(shardConservationPort(connection, "https://shard.test", read)())).toEqual([
    { gameId: 7, confirmedBlock: 10, receipts: "17", netIssued: "17" },
  ]);
  expect(read).toHaveBeenCalledTimes(2);
  expect(String(read.mock.calls[1]![0])).toContain("models=ChestRules,LordsBudget,LordsWithdrawal");
});
it("accounts for refills through pool_left and preserves exact integers beyond Number precision", async () => {
  const amount = String(2n ** 80n);
  const state = snapshot("100", amount);
  state.models[0]!.rows[0]!.value = { ...state.models[0]!.rows[0]!.value, pool: String(2n ** 80n + 99n) };
  expect(await Effect.runPromise(shardConservationPort(connection, "https://shard.test", network(state))())).toEqual([
    { gameId: 7, confirmedBlock: 10, receipts: amount, netIssued: String(2n ** 80n - 1n) },
  ]);
});
it("accepts an explicitly present empty receipt model, and never defaults a missing model to zero", async () => {
  const state = snapshot("100");
  state.models[2]!.rows = [];
  expect(
    (await Effect.runPromise(shardConservationPort(connection, "https://shard.test", network(state))()))[0]!.receipts,
  ).toBe("0");
  state.models.pop();
  await expect(
    Effect.runPromise(shardConservationPort(connection, "https://shard.test", network(state))()),
  ).rejects.toThrow();
});
it("rejects previous receipt and budget schemas, duplicate claims, wrong games and unconfirmed snapshots", async () => {
  const malformed = [snapshot(), snapshot(), snapshot(), snapshot(), snapshot()];
  Object.assign(malformed[0]!.models[1]!.rows[0]!.value, { spent: "4" });
  Object.assign(malformed[1]!.models[2]!.rows[0]!.value, { player: "0x456" });
  malformed[2]!.models[2]!.rows.push(malformed[2]!.models[2]!.rows[0]!);
  malformed[3]!.models[2]!.rows[0]!.value.game_id = 8;
  malformed[4]!.confirmed_block = 9;
  for (const state of malformed)
    await expect(
      Effect.runPromise(shardConservationPort(connection, "https://shard.test", network(state))()),
    ).rejects.toThrow();
  rpc.block.mockResolvedValue({ status: "PRE_CONFIRMED", block_number: 10 });
  await expect(
    Effect.runPromise(shardConservationPort(connection, "https://shard.test", network())()),
  ).rejects.toThrow();
});
it("binds the directory to the chain/world and the exact preset mode instead of skipping unrecognized games", async () => {
  const malformed = [directory(), directory(), directory()];
  malformed[0]!.chain = "0x2";
  malformed[1]!.world_address = "0x20";
  malformed[2]!.games[0]!.mode = "blitz";
  for (const games of malformed)
    await expect(
      Effect.runPromise(shardConservationPort(connection, "https://shard.test", network(snapshot(), games))()),
    ).rejects.toThrow();
});
it("fails closed on unavailable finalized state or a transport fault", async () => {
  const read = vi.fn(async (url: URL | RequestInfo) =>
    new URL(String(url)).pathname === "/games"
      ? Response.json(directory())
      : Response.json({ error: "game_finalized" }, { status: 409 }),
  );
  await expect(Effect.runPromise(shardConservationPort(connection, "https://shard.test", read)())).rejects.toThrow();
  await expect(
    Effect.runPromise(
      shardConservationPort(
        connection,
        "https://shard.test",
        vi.fn(async () => {
          throw new Error("offline");
        }),
      )(),
    ),
  ).rejects.toThrow();
});

const monitorFixture = () => {
  let progress: MonitorProgress = { halted: null };
  const ports: MonitorPorts = {
    identity: { payoutWallet: () => Effect.succeed({ status: "ready", address: "0x123" }) },
    shard: {
      conservation: shardConservationPort(connection, "https://shard.test", network(snapshot("84"))),
      withdrawal: () => Effect.fail(new RelayFailure({ operation: "binding_missing" })),
      result: () => Effect.succeed(null),
    },
    ledger: {
      pause: vi.fn(() => Effect.void),
      paidClaims: () => Effect.succeed({ rows: [], next: null }),
      postedResults: () => Effect.succeed({ rows: [], next: null }),
    },
  };
  const store = {
    load: async () => progress,
    save: async (next: MonitorProgress) => {
      progress = next;
    },
  };
  return { ports, store };
};
it("persists and pauses a conservation violation before the unavailable paid-claim binding", async () => {
  const f = monitorFixture();
  f.ports.ledger.paidClaims = vi.fn(() => Effect.fail(new RelayFailure({ operation: "must_not_read" })));
  expect(await Effect.runPromise(runMonitor(f.ports, f.store))).toEqual({ halted: "lords_conservation:7:10" });
  expect(f.ports.ledger.pause).toHaveBeenCalledOnce();
  expect(f.ports.ledger.paidClaims).not.toHaveBeenCalled();
});
it("still detects a posted-result mismatch when conservation and paid-claim reads are unavailable", async () => {
  const f = monitorFixture();
  f.ports.shard.conservation = () => Effect.fail(new RelayFailure({ operation: "source_missing" }));
  f.ports.ledger.paidClaims = () => Effect.fail(new RelayFailure({ operation: "binding_missing" }));
  f.ports.ledger.postedResults = () =>
    Effect.succeed({ rows: [{ chainId: "0x1", gameId: 8, commitment: "0xabc" }], next: null });
  expect(await Effect.runPromise(runMonitor(f.ports, f.store))).toEqual({ halted: "blitz_result_mismatch:8" });
  expect(f.ports.ledger.pause).toHaveBeenCalledOnce();
});
it("returns an unavailable audit rather than green when no violation is provable", async () => {
  const f = monitorFixture();
  f.ports.shard.conservation = () => Effect.fail(new RelayFailure({ operation: "source_missing" }));
  await expect(Effect.runPromise(runMonitor(f.ports, f.store))).rejects.toMatchObject({ operation: "source_missing" });
  expect(f.ports.ledger.pause).not.toHaveBeenCalled();
});

it("refuses rounded JSON amounts and empty integer text instead of inventing a balance", async () => {
  const state = snapshot();
  state.models[2]!.rows[0]!.value.amount = Number(2n ** 80n);
  await expect(
    Effect.runPromise(shardConservationPort(connection, "https://shard.test", network(state))()),
  ).rejects.toThrow();
  state.models[2]!.rows[0]!.value.amount = "";
  await expect(
    Effect.runPromise(shardConservationPort(connection, "https://shard.test", network(state))()),
  ).rejects.toThrow();
});
