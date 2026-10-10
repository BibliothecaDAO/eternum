import { Effect } from "effect";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ShardReader } from "./shard-rpc";
import { frontierReceiptBindings } from "./frontier-binding";

const rpc = vi.hoisted(() => ({ blockHash: "0xa", shardCall: vi.fn(), events: vi.fn(), ledgerCall: vi.fn() }));
vi.mock("@realms-world/value-ledger", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger")>()),
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
const reader = new ShardReader({ rpcUrl: "https://shard.test", gamesAddress: "0x77", chainId: "0x1" });
const bind = () =>
  frontierReceiptBindings(
    reader,
    { rpcUrl: "https://ledger.test", address: "0x10" },
    { realmsIdForAccount: async () => "0x2" },
  );
beforeEach(() => {
  vi.clearAllMocks();
  rpc.blockHash = "0xa";
  rpc.shardCall.mockResolvedValue(["0x5", "5", "0", "1", "0", "0", "10", "110", "0", "0x99"]);
  rpc.ledgerCall.mockImplementation(async (query) =>
    query.entrypoint === "frontier_claim_deadline"
      ? ["604910"]
      : query.entrypoint === "get_preset"
        ? [...Array(17).fill("0"), "1", "5", "604800", "24"]
        : ["1", "10", "110", "100000000000000000000", "0", "0", "0", "0", "2", "0x99"],
  );
});
it("reads funding by shard game id without history scans or Herald calendar reads", async () => {
  expect(await Effect.runPromise(bind().frontierSeason(7, 50))).toBe(7);
  expect(rpc.ledgerCall).toHaveBeenCalledWith(
    { contractAddress: "0x10", entrypoint: "get_frontier", calldata: ["0x1", "7"] },
    100,
  );
  expect(rpc.events).not.toHaveBeenCalled();
});
it("refuses different funding and the exclusive receipt deadline", async () => {
  rpc.shardCall.mockResolvedValue(["0x5", "5", "0", "1", "0", "0", "11", "110", "0", "0x99"]);
  await expect(Effect.runPromise(bind().frontierSeason(7, 50))).rejects.toMatchObject({
    operation: "resolve_frontier_funding",
  });
  rpc.shardCall.mockResolvedValue(["0x5", "5", "0", "1", "0", "0", "10", "110", "0", "0x98"]);
  await expect(Effect.runPromise(bind().frontierSeason(7, 50))).rejects.toThrow();
  rpc.shardCall.mockResolvedValue(["0x5", "5", "0", "1", "0", "0", "10", "110", "0", "0x99"]);
  await expect(Effect.runPromise(bind().frontierSeason(7, 604910))).rejects.toThrow();
});
it("rereads restored game funding instead of reusing a previous match", async () => {
  expect(await Effect.runPromise(bind().frontierSeason(7, 50))).toBe(7);
  rpc.blockHash = "0xb";
  rpc.shardCall.mockResolvedValue(["0x5", "5", "0", "1", "0", "0", "10", "110", "0", "0x98"]);
  await expect(Effect.runPromise(bind().frontierSeason(7, 50))).rejects.toThrow();
  const previous = rpc.ledgerCall.getMockImplementation()!;
  rpc.ledgerCall.mockImplementation(async (query) =>
    query.entrypoint === "get_frontier"
      ? ["1", "10", "110", "100000000000000000000", "0", "0", "0", "0", "2", "0x98"]
      : previous(query),
  );
  expect(await Effect.runPromise(bind().frontierSeason(7, 50))).toBe(7);
});
afterEach(() => vi.unstubAllGlobals());
