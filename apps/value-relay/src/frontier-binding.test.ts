import { Effect } from "effect";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ShardReader } from "./shard-rpc";
import { frontierReceiptBindings } from "./frontier-binding";

const rpc = vi.hoisted(() => ({ blockHash: "0xa", shardCall: vi.fn(), events: vi.fn(), ledgerCall: vi.fn() }));
vi.mock("../../../packages/value-ledger/src/rpc", async (original) => ({
  ...(await original<typeof import("../../../packages/value-ledger/src/rpc")>()),
  rpcAt: (url: string) =>
    url.includes("shard")
      ? {
          getChainId: async () => "0x1",
          getBlock: async () => ({
            status: "ACCEPTED_ON_L2",
            block_number: 10,
            block_hash: rpc.blockHash,
            parent_hash: "0x9",
            timestamp: 50,
          }),
          callContract: rpc.shardCall,
        }
      : {
          getBlockNumber: async () => 100,
          getBlock: async (n: number | string) => ({
            block_number: n === "latest" ? 100 : n,
            block_hash: "0xaa",
            status: "ACCEPTED_ON_L2",
            timestamp: 50,
          }),
          getEvents: rpc.events,
          callContract: rpc.ledgerCall,
        },
}));
const reader = new ShardReader({ rpcUrl: "https://shard.test", gamesAddress: "0x77", chainId: "0x1", firstRelease: 1 });
const bind = () =>
  frontierReceiptBindings(
    reader,
    () => ({ rpcUrl: "https://ledger.test", address: "0x10" }),
    {
      realmsIdForAccount: async () => "0x2",
    },
    "https://herald.test",
  );
beforeEach(() => {
  vi.clearAllMocks();
  rpc.blockHash = "0xa";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const game = await rpc.shardCall();
      return Response.json({
        game_id: "7",
        confirmed_block: 10,
        models: [
          {
            model: "GameRegistry",
            rows: [
              { key: "7", value: { game_id: 7, preset_id: 6, start_main_at: game[6], end_at: game[7], seed: game[9] } },
            ],
          },
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
                  pool_left: "100",
                  open: "0",
                  day: "0",
                  price: "10",
                  rolled_shares: "0",
                  yesterday_shares: "0",
                  yesterday_ticks: "0",
                },
              },
            ],
          },
          { model: "SliceRules", rows: [{ key: "7", value: { game_id: 7, day_unit_seconds: 5 } }] },
        ],
      });
    }),
  );
  rpc.shardCall.mockResolvedValue(["0x5", "5", "0", "1", "0", "0", "10", "110", "0", "0x99"]);
  rpc.ledgerCall.mockImplementation(async (query) =>
    query.entrypoint === "get_preset"
      ? ["0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "5", "604800", "10", "7000"]
      : ["1", "10", "110", "100000000000000000000", "0", "0", "0", "0", "6", "0x99", "0", "0", "0", "0"],
  );
});
it("reads funding by shard game id without history scans or Herald calendar reads", async () => {
  expect(await Effect.runPromise(bind().frontierSeason(7, 50, 0))).toBe(7);
  expect(rpc.ledgerCall).toHaveBeenCalledWith(
    { contractAddress: "0x10", entrypoint: "get_frontier", calldata: ["0x1", "7"] },
    100,
  );
  expect(rpc.events).not.toHaveBeenCalled();
});
it("refuses different funding and the exclusive receipt deadline", async () => {
  rpc.shardCall.mockResolvedValue(["0x5", "5", "0", "1", "0", "0", "11", "110", "0", "0x99"]);
  await expect(Effect.runPromise(bind().frontierSeason(7, 50, 0))).rejects.toMatchObject({
    operation: "frontier_funding_differs_from_game",
  });
  rpc.shardCall.mockResolvedValue(["0x5", "5", "0", "1", "0", "0", "10", "110", "0", "0x98"]);
  await expect(Effect.runPromise(bind().frontierSeason(7, 50, 0))).rejects.toThrow();
  rpc.shardCall.mockResolvedValue(["0x5", "5", "0", "1", "0", "0", "10", "110", "0", "0x99"]);
  await expect(Effect.runPromise(bind().frontierSeason(7, 604910, 0))).rejects.toThrow();
});
it("rereads restored game funding instead of reusing a previous match", async () => {
  expect(await Effect.runPromise(bind().frontierSeason(7, 50, 0))).toBe(7);
  rpc.blockHash = "0xb";
  rpc.shardCall.mockResolvedValue(["0x5", "5", "0", "1", "0", "0", "10", "110", "0", "0x98"]);
  await expect(Effect.runPromise(bind().frontierSeason(7, 50, 0))).rejects.toThrow();
  const previous = rpc.ledgerCall.getMockImplementation()!;
  rpc.ledgerCall.mockImplementation(async (query) =>
    query.entrypoint === "get_frontier"
      ? ["1", "10", "110", "100000000000000000000", "0", "0", "0", "0", "6", "0x98", "0", "0", "0", "0"]
      : previous(query),
  );
  expect(await Effect.runPromise(bind().frontierSeason(7, 50, 0))).toBe(7);
});
afterEach(() => vi.unstubAllGlobals());

it.each(["get_frontier", "get_preset"])("fails when %s refuses unfunded Frontier custody", async (entrypoint) => {
  const previous = rpc.ledgerCall.getMockImplementation()!;
  rpc.ledgerCall.mockImplementation(async (query) => {
    if (query.entrypoint === entrypoint) throw new Error("Ledger: unknown Frontier season");
    return previous(query);
  });
  await expect(Effect.runPromise(bind().frontierSeason(7, 50, 0))).rejects.toMatchObject({
    operation: "resolve_frontier_funding",
  });
});

it("keeps a funding mismatch unavailable when the snapshot pool differs", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        game_id: "7",
        confirmed_block: 10,
        models: [
          {
            model: "GameRegistry",
            rows: [{ key: "7", value: { game_id: 7, preset_id: 6, start_main_at: 10, end_at: 110, seed: "0x99" } }],
          },
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
                  pool: "101",
                  pool_left: "100",
                  open: "0",
                  day: "0",
                  price: "10",
                  rolled_shares: "0",
                  yesterday_shares: "0",
                  yesterday_ticks: "0",
                },
              },
            ],
          },
          { model: "SliceRules", rows: [{ key: "7", value: { game_id: 7, day_unit_seconds: 5 } }] },
        ],
      }),
    ),
  );
  await expect(Effect.runPromise(bind().frontierSeason(7, 50, 0))).rejects.toMatchObject({
    operation: "frontier_pool_differs_from_ledger",
  });
});

it("refuses a different whole-bag end in the shared relay and monitor receipt binding", async () => {
  rpc.shardCall.mockResolvedValue(["0x5", "5", "0", "1", "0", "0", "10", "210", "0", "0x99"]);
  await expect(Effect.runPromise(bind().frontierSeason(7, 50, 0))).rejects.toMatchObject({
    operation: "frontier_funding_differs_from_game",
  });
});

it("allows a season prize after chest claims close but never before season end", async () => {
  await expect(Effect.runPromise(bind().frontierSeason(7, 109, 1))).rejects.toThrow();
  expect(await Effect.runPromise(bind().frontierSeason(7, 604910, 1))).toBe(7);
});
