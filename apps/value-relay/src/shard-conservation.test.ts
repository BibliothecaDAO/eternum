import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { shardConservationPort } from "./shard-conservation";
import { runMonitor, type MonitorProgress } from "./monitor";
import type { ConfirmedSnapshot } from "./shard-snapshot";
import { RelayFailure, type MonitorPorts } from "./ports";
import { CallData } from "starknet";
import schema from "../../../contracts/l3/world-native/schema/schema.json";
import { gamesAbi } from "../../../packages/value-ledger/test-support/abi";

const rpc = vi.hoisted(() => ({ chain: vi.fn(), block: vi.fn() }));
vi.mock("../../../packages/value-ledger/src/rpc", async (original) => ({
  ...(await original<typeof import("../../../packages/value-ledger/src/rpc")>()),
  rpcAt: () => ({ getChainId: rpc.chain, getBlock: rpc.block }),
}));
const connection = { chainId: "0x1", gamesAddress: "0x10", rpcUrl: "https://shard.test/rpc", firstRelease: 1 };
const directory = () => ({
  chain: "0x1",
  world_address: "0x10",
  confirmed_block: 10,
  games: [
    { game_id: 7, preset_id: 5, mode: "frontier", status: "Live", clock: { end_at: 9000 } },
    { game_id: 8, preset_id: 2, mode: "blitz" },
  ],
});
const snapshot = (poolLeft = "83", amount = "17"): ConfirmedSnapshot => ({
  game_id: "7",
  confirmed_block: 10,
  models: [
    {
      model: "ChestRules",
      rows: [
        {
          key: "7",
          value: {
            pool_bps: 7000,
            top_n: 10,
            game_id: 7,
            price_ceiling: "10",
            shares: { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 },
            claim_window_seconds: 604800,
          },
        },
      ],
    },
    {
      model: "LordsBudget",
      rows: [
        {
          key: "7",
          value: {
            game_id: 7,
            pool: "100",
            pool_left: poolLeft,
            open: "3",
            day: "1",
            price: "2",
            rolled_shares: "7",
            yesterday_shares: "50",
            yesterday_ticks: "10",
          },
        },
      ],
    },
    {
      model: "LordsWithdrawal",
      rows: [
        {
          key: "7:0xabc",
          value: { prize_rank: 0, prize_count: 0, game_id: 7, claim_id: "0xabc", account: "0x123", amount },
        },
      ],
    },
    { model: "FrontierPrize", rows: [{ key: "7", value: { game_id: 7, pool: "0", issued: "0", count: null } }] },
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
it("uses complete chest and budget fixtures matching the committed shard schema", () => {
  for (const { model: name, rows } of snapshot().models.slice(0, 2)) {
    const model = schema.models.find((model) => model.name === name)!;
    const fields = [...model.keys, ...model.members];
    const value = rows[0]!.value;
    expect(Object.keys(value).sort()).toEqual(fields.map(({ name }) => name).sort());
    const calldata = new CallData([
      ...gamesAbi,
      { type: "function", name: "fixture", inputs: fields, outputs: [], state_mutability: "view" },
    ]).compile("fixture", value as never);
    expect(calldata.map(BigInt)).toEqual(
      name === "ChestRules"
        ? [7n, 10n, 1n, 2n, 3n, 4n, 5n, 604800n, 7000n, 10n]
        : [7n, 100n, 83n, 3n, 1n, 2n, 7n, 50n, 10n],
    );
  }
});
it.each(["price", "rolled_shares", "yesterday_shares", "yesterday_ticks"])(
  "requires an exact unsigned budget %s without changing conservation arithmetic",
  async (field) => {
    const state = snapshot();
    const budget = state.models[1]!.rows[0]!.value;
    const read = () => Effect.runPromise(shardConservationPort(connection, "https://shard.test", network(state))());
    budget[field] = "0";
    expect((await read())[0]).toMatchObject({ pool: "100", receipts: "17", netIssued: "17" });
    for (const invalid of [-1, Number(2n ** 80n), String(2n ** BigInt(field === "yesterday_ticks" ? 64 : 128))]) {
      budget[field] = invalid;
      await expect(read()).rejects.toThrow();
    }
    delete budget[field];
    await expect(read()).rejects.toThrow();
  },
);
it("refuses the retired fixed-price rules instead of defaulting a missing ceiling", async () => {
  const state = snapshot();
  const rules = state.models[0]!.rows[0]!.value;
  rules.price = rules.price_ceiling;
  delete rules.price_ceiling;
  await expect(
    Effect.runPromise(shardConservationPort(connection, "https://shard.test", network(state))()),
  ).rejects.toThrow();
});
it("uses one confirmed budget and the sum of immutable receipts in whole LORDS, without counting open reservations", async () => {
  const read = network();
  expect(await Effect.runPromise(shardConservationPort(connection, "https://shard.test", read)())).toEqual([
    { chainId: "0x1", pool: "100", gameId: 7, confirmedBlock: 10, receipts: "17", netIssued: "17" },
  ]);
  expect(read).toHaveBeenCalledTimes(2);
  expect(String(read.mock.calls[1]![0])).toContain("models=ChestRules,LordsBudget,LordsWithdrawal");
});
it("accounts for refills through pool_left and preserves exact integers beyond Number precision", async () => {
  const amount = String(2n ** 80n);
  const state = snapshot("100", amount);
  state.models[1]!.rows[0]!.value = { ...state.models[1]!.rows[0]!.value, pool: String(2n ** 80n + 99n) };
  expect(await Effect.runPromise(shardConservationPort(connection, "https://shard.test", network(state))())).toEqual([
    {
      chainId: "0x1",
      pool: String(2n ** 80n + 99n),
      gameId: 7,
      confirmedBlock: 10,
      receipts: amount,
      netIssued: String(2n ** 80n - 1n),
    },
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
  const malformed = Array.from({ length: 7 }, () => snapshot());
  Object.assign(malformed[0]!.models[1]!.rows[0]!.value, { spent: "4" });
  Object.assign(malformed[1]!.models[2]!.rows[0]!.value, { player: "0x456" });
  malformed[2]!.models[2]!.rows.push(malformed[2]!.models[2]!.rows[0]!);
  malformed[3]!.models[2]!.rows[0]!.value.game_id = 8;
  malformed[4]!.confirmed_block = 9;
  Object.assign(malformed[5]!.models[1]!.rows[0]!.value, { estimate: "20" });
  Object.assign(malformed[6]!.models[0]!.rows[0]!.value, { estimate_days: 5 });
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
    identity: { matchesPayDecision: () => Effect.succeed(true) },
    shard: {
      withdrawalReceipt: () => Effect.succeed(null),
      settlementEvidence: () => Effect.succeed(null),
      conservation: shardConservationPort(connection, "https://shard.test", network(snapshot("84"))),
      withdrawal: () => Effect.fail(new RelayFailure({ operation: "binding_missing" })),
      result: () => Effect.succeed(null),
    },
    ledger: {
      approvePayment: () => Effect.void,
      approveSettlement: () => Effect.void,
      frontierPool: () => Effect.succeed(String(100n * 10n ** 18n)),
      pause: vi.fn(() => Effect.void),
      reportedSettlements: () =>
        Effect.succeed({
          rows: [],
          next: null,
          head: 0,
          anchor: { number: 0, hash: "0x1" },
          rewind: false,
          fromBlock: 0,
        }),
      reportedClaims: () =>
        Effect.succeed({
          rows: [],
          next: null,
          head: 0,
          anchor: { number: 0, hash: "0x1" },
          rewind: false,
          fromBlock: 0,
        }),
      paidClaims: () =>
        Effect.succeed({
          rows: [],
          next: null,
          head: 1000,
          anchor: { number: 1000, hash: "0xa" },
          rewind: false,
          fromBlock: 1,
        }),
      postedResults: () =>
        Effect.succeed({
          rows: [],
          next: null,
          head: 1000,
          anchor: { number: 1000, hash: "0xa" },
          rewind: false,
          fromBlock: 1,
        }),
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
  expect(await Effect.runPromise(runMonitor(f.ports, f.store))).toMatchObject({ halted: "lords_conservation:7:10" });
  expect(f.ports.ledger.pause).toHaveBeenCalledOnce();
  expect(f.ports.ledger.paidClaims).not.toHaveBeenCalled();
});
it("still detects a posted-result mismatch when conservation and paid-claim reads are unavailable", async () => {
  const f = monitorFixture();
  f.ports.shard.conservation = () => Effect.fail(new RelayFailure({ operation: "source_missing" }));
  f.ports.ledger.paidClaims = () => Effect.fail(new RelayFailure({ operation: "binding_missing" }));
  f.ports.ledger.postedResults = () =>
    Effect.succeed({
      rows: [{ chainId: "0x1", gameId: 8, commitment: "0xabc" }],
      next: null,
      head: 1000,
      anchor: { number: 1000, hash: "0xa" },
      rewind: false,
      fromBlock: 1,
    });
  expect(await Effect.runPromise(runMonitor(f.ports, f.store))).toMatchObject({ halted: "blitz_result_mismatch:8" });
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

it("rereads settled balances after the claim window instead of retaining a second truth", async () => {
  const state = snapshot();
  state.models[0]!.rows[0]!.value.claim_window_seconds = 10;
  const games = directory();
  Object.assign(games.games[0]!, { status: "Settled", clock: { end_at: 1 } });
  const read = network(state, games),
    values = new Map<string, unknown>();
  const cache = {
    get: async <T>(key: string) => values.get(key) as T | undefined,
    put: async (key: string, value: unknown) => {
      values.set(key, value);
    },
  };
  const first = shardConservationPort(connection, "https://shard.test", read, cache);
  await Effect.runPromise(first());
  const second = shardConservationPort(connection, "https://shard.test", read, cache);
  expect(await Effect.runPromise(second())).toEqual([
    { chainId: "0x1", pool: "100", gameId: 7, confirmedBlock: 10, receipts: "17", netIssued: "17" },
  ]);
  expect(read.mock.calls.filter(([url]) => String(url).includes("/snapshot"))).toHaveLength(2);
});

it("bounds first-time conservation snapshots and rotates unfinished games", async () => {
  const games = directory();
  games.games = Array.from({ length: 30 }, (_, index) => ({
    game_id: index + 1,
    preset_id: 5,
    mode: "frontier",
    status: "Live",
    clock: { end_at: 9000 },
  }));
  const values = new Map<string, unknown>();
  const cache = {
    get: async <T>(key: string) => values.get(key) as T | undefined,
    put: async (key: string, value: unknown) => {
      values.set(key, value);
    },
  };
  const read = vi.fn(async (url: URL | RequestInfo) => {
    const path = new URL(String(url)).pathname;
    if (path === "/games") return Response.json(games);
    const id = Number(path.split("/")[2]),
      body = snapshot();
    body.game_id = String(id);
    for (const model of body.models) for (const row of model.rows) row.value.game_id = id;
    return Response.json(body);
  });
  expect((await Effect.runPromise(shardConservationPort(connection, "https://shard.test", read, cache)())).length).toBe(
    25,
  );
  expect(
    (await Effect.runPromise(shardConservationPort(connection, "https://shard.test", read, cache)())).map(
      (row) => row.gameId,
    ),
  ).toEqual([26, 27, 28, 29, 30]);
});
it("rereads a final balance when its source block was replaced", async () => {
  const state = snapshot();
  state.models[0]!.rows[0]!.value.claim_window_seconds = 10;
  const games = directory();
  Object.assign(games.games[0]!, { status: "Settled", clock: { end_at: 1 } });
  const values = new Map<string, unknown>();
  const cache = {
    get: async <T>(key: string) => values.get(key) as T | undefined,
    put: async (key: string, value: unknown) => {
      values.set(key, value);
    },
  };
  const read = network(state, games);
  await Effect.runPromise(shardConservationPort(connection, "https://shard.test", read, cache)());
  rpc.block.mockImplementation(async (height) => ({
    block_number: height === "latest" ? 10 : height,
    block_hash: "0xb",
    parent_hash: "0x9",
    timestamp: 1000,
    status: "ACCEPTED_ON_L2",
  }));
  state.models[1]!.rows[0]!.value.pool_left = "100";
  state.models[2]!.rows = [];
  expect(await Effect.runPromise(shardConservationPort(connection, "https://shard.test", read, cache)())).toEqual([
    { chainId: "0x1", pool: "100", gameId: 7, confirmedBlock: 10, receipts: "0", netIssued: "0" },
  ]);
  expect(read.mock.calls.filter(([url]) => String(url).includes("/snapshot"))).toHaveLength(2);
});

it("a new Frontier game with no budget has issued nothing and does not pause the monitor", async () => {
  const state = snapshot();
  state.models[1]!.rows = [];
  state.models[2]!.rows = [];
  const f = monitorFixture();
  f.ports.shard.conservation = shardConservationPort(connection, "https://shard.test", network(state));
  expect(await Effect.runPromise(f.ports.shard.conservation())).toEqual([
    { chainId: "0x1", pool: "0", gameId: 7, confirmedBlock: 10, receipts: "0", netIssued: "0" },
  ]);
  for (let tick = 0; tick < 5; tick++)
    expect(await Effect.runPromise(runMonitor(f.ports, f.store))).toMatchObject({ halted: null });
  expect(f.ports.ledger.pause).not.toHaveBeenCalled();
  state.models.splice(1, 1);
  await expect(Effect.runPromise(f.ports.shard.conservation())).rejects.toThrow();
});

it("pauses when the published pool exceeds its ledger custody", async () => {
  const f = monitorFixture();
  f.ports.shard.conservation = shardConservationPort(connection, "https://shard.test", network());
  f.ports.ledger.frontierPool = () => Effect.succeed(String(99n * 10n ** 18n));
  expect(await Effect.runPromise(runMonitor(f.ports, f.store))).toMatchObject({
    halted: "frontier_pool_mismatch:0x1:7",
  });
  expect(f.ports.ledger.pause).toHaveBeenCalledOnce();
});

it("keeps a funded-pool audit red without pausing when the ledger cannot be read", async () => {
  const f = monitorFixture();
  f.ports.shard.conservation = shardConservationPort(connection, "https://shard.test", network());
  f.ports.ledger.frontierPool = () => Effect.fail(new RelayFailure({ operation: "funding_unavailable" }));
  for (let tick = 0; tick < 5; tick++)
    await expect(Effect.runPromise(runMonitor(f.ports, f.store))).rejects.toMatchObject({
      operation: "funding_unavailable",
    });
  expect((await f.store.load()).halted).toBeNull();
  expect((await f.store.load()).fault).toBeUndefined();
  expect(f.ports.ledger.pause).not.toHaveBeenCalled();
});

it("continues to a proven mismatch after another pool cannot be checked", async () => {
  const f = monitorFixture();
  const balance = (await Effect.runPromise(shardConservationPort(connection, "https://shard.test", network())()))[0]!;
  f.ports.shard.conservation = () => Effect.succeed([balance, { ...balance, gameId: 8 }]);
  f.ports.ledger.frontierPool = (_chain, game) =>
    game === 7
      ? Effect.fail(new RelayFailure({ operation: "funding_unavailable" }))
      : Effect.succeed(String(99n * 10n ** 18n));
  expect(await Effect.runPromise(runMonitor(f.ports, f.store))).toMatchObject({
    halted: "frontier_pool_mismatch:0x1:8",
  });
  expect(f.ports.ledger.pause).toHaveBeenCalledOnce();
});

it("audits prize receipts separately and refuses missing funded prize state", async () => {
  const state = snapshot();
  state.models[3]!.rows[0]!.value = { game_id: 7, pool: "300", issued: "50", count: 10 };
  state.models[2]!.rows.push({
    key: "7:0xdef",
    value: {
      game_id: 7,
      claim_id: "0xdef",
      account: "0x456",
      amount: "50",
      prize_rank: 1,
      prize_count: 10,
    },
  });
  const read = () => Effect.runPromise(shardConservationPort(connection, "https://shard.test", network(state))());
  expect(await read()).toEqual([
    { chainId: "0x1", gameId: 7, confirmedBlock: 10, pool: "100", receipts: "67", netIssued: "67" },
  ]);
  state.models[3]!.rows[0]!.value.issued = "51";
  await expect(read()).rejects.toThrow();
  state.models[3]!.rows = [];
  state.models[2]!.rows.pop();
  await expect(read()).rejects.toThrow();
});
