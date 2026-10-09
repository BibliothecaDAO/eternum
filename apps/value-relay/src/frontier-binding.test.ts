import { Effect } from "effect";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { hash } from "starknet";
import { ShardReader } from "./shard-rpc";
import { frontierReceiptBindings } from "./frontier-binding";

const rpc = vi.hoisted(() => ({ shardCall: vi.fn(), events: vi.fn(), ledgerCall: vi.fn() }));
vi.mock("@realms-world/value-ledger", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger")>()),
  rpcAt: (url: string) =>
    url.includes("shard")
      ? {
          getChainId: async () => "0x1",
          getBlock: async () => ({
            status: "ACCEPTED_ON_L2",
            block_number: 10,
            block_hash: "0xa",
            parent_hash: "0x9",
            timestamp: 50,
          }),
          callContract: rpc.shardCall,
        }
      : { getBlockNumber: async () => 100, getEvents: rpc.events, callContract: rpc.ledgerCall },
}));
const reader = new ShardReader({ rpcUrl: "https://shard.test", gamesAddress: "0x77", chainId: "0x1" });
const bind = () =>
  frontierReceiptBindings(
    reader,
    { rpcUrl: "https://ledger.test", address: "0x10" },
    { realmsIdForAccount: async () => "0x2" },
    "https://herald.test",
  );
beforeEach(() => {
  vi.clearAllMocks();
  rpc.shardCall.mockResolvedValue(["0x5", "5", "0", "1", "0", "0", "10", "110", "0", "0x99"]);
  rpc.events.mockResolvedValue({
    events: [
      {
        from_address: "0x10",
        keys: [hash.getSelectorFromName("FrontierFunded"), "0x1", "0x2a"],
        data: ["10", "110", "100000000000000000000", "0"],
      },
    ],
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        confirmed_block: 10,
        game_id: "7",
        models: [
          { model: "SliceRules", rows: [{ key: "7", value: { game_id: 7, day_unit_seconds: 1 } }] },
          {
            model: "ChestRules",
            rows: [{ key: "7", value: { game_id: 7, pool: "100", claim_window_seconds: 604800 } }],
          },
        ],
      }),
    ),
  );
  rpc.ledgerCall.mockImplementation(async (query) =>
    query.entrypoint === "frontier_claim_deadline"
      ? ["604910"]
      : query.entrypoint === "get_preset"
        ? [...Array(17).fill("0"), "1", "5", "604800"]
        : ["1", "10", "110", "100000000000000000000", "0", "0", "0", "0", "2", "0x99"],
  );
});
it("binds immutable game timing and seed to the funded season instead of assuming game id equals season id", async () => {
  expect(await Effect.runPromise(bind().frontierSeason(7, 50))).toBe(42);
  expect(rpc.ledgerCall).toHaveBeenCalledWith(
    { contractAddress: "0x10", entrypoint: "get_frontier", calldata: ["0x1", "42"] },
    100,
  );
});
it("refuses ambiguous funding, changed seed, or a receipt at the exclusive deadline", async () => {
  await expect(Effect.runPromise(bind().frontierSeason(7, 604910))).rejects.toThrow();
  rpc.shardCall.mockResolvedValue(["0x5", "5", "0", "1", "0", "0", "10", "110", "0", "0x98"]);
  await expect(Effect.runPromise(bind().frontierSeason(7, 50))).rejects.toThrow();
  rpc.shardCall.mockResolvedValue(["0x5", "5", "0", "1", "0", "0", "10", "110", "0", "0x99"]);
  rpc.events.mockResolvedValue({
    events: [42, 43].map((id) => ({
      from_address: "0x10",
      keys: [hash.getSelectorFromName("FrontierFunded"), "0x1", `0x${id.toString(16)}`],
      data: ["10", "110", "100000000000000000000", "0"],
    })),
  });
  await expect(Effect.runPromise(bind().frontierSeason(7, 50))).rejects.toThrow();
});

afterEach(() => vi.unstubAllGlobals());
