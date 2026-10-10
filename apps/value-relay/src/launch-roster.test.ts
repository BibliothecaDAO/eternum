import { beforeEach, expect, it, vi } from "vitest";
import { ValueRelay } from "./worker";
const rpc = vi.hoisted(() => ({ chain: vi.fn(), block: vi.fn(), call: vi.fn() }));
vi.mock("cloudflare:workers", () => ({
  WorkerEntrypoint: class {},
  DurableObject: class {
    constructor(
      public ctx: unknown,
      public env: unknown,
    ) {}
  },
}));
vi.mock("@realms-world/value-ledger", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger")>()),
  rpcAt: () => ({ getChainId: rpc.chain, getBlock: rpc.block, callContract: rpc.call }),
}));
const key = { chainId: "0x1", gameId: 7 };
const game = (start = "200") => ["1", "1", "1", start, "300", "0", "0", "0", "1", "0", "0", "2"];
const relay = () =>
  new ValueRelay(
    {
      storage: { setAlarm: async () => {} },
      blockConcurrencyWhile: async (run: () => Promise<unknown>) => run(),
    } as unknown as DurableObjectState,
    {
      LEDGER_RPC_URL: "https://ledger.test",
      LEDGER_ADDRESS: "0x10",
      IDENTITY: {
        l2ChainId: async () => "0x2",
        shards: async () => [{ chainId: "0x1", url: "https://shard.test", status: "active" }],
      },
    } as never,
  );
beforeEach(() => {
  vi.clearAllMocks();
  rpc.chain.mockResolvedValue("0x2");
  rpc.block.mockResolvedValue({ block_number: 100, block_hash: "0xab", timestamp: 200, status: "ACCEPTED_ON_L2" });
  rpc.call.mockImplementation(async (request) => (request.entrypoint === "get_game" ? game() : ["0x123", "0x456"]));
});
it("serves the immutable ledger pairs at one confirmed head through the chain guard", async () => {
  expect(await relay().blitzRoster(key)).toEqual({
    gameId: 7,
    blockNumber: 100,
    blockHash: "0xab",
    secondsUntilClose: 0,
    end: 300,
    registrations: [{ wallet: "0x123", account: "0x456" }],
  });
  expect(rpc.call.mock.calls.every((call) => call[1] === 100)).toBe(true);
});
it("refuses another L2 chain and provisional reads before fetching registrations", async () => {
  rpc.chain.mockResolvedValue("0x3");
  await expect(relay().blitzRoster(key)).rejects.toThrow();
  expect(rpc.call).not.toHaveBeenCalled();
  rpc.chain.mockResolvedValue("0x2");
  rpc.block.mockResolvedValue({ timestamp: 200 });
  await expect(relay().blitzRoster(key)).rejects.toThrow();
  expect(rpc.call).not.toHaveBeenCalled();
});
it("reports the ledger's close time and rejects an oversold registration list", async () => {
  rpc.call.mockResolvedValue(game("290"));
  expect(await relay().blitzRoster(key)).toMatchObject({ secondsUntilClose: 90, registrations: [] });
  const bad = game();
  bad[8] = "3";
  bad[11] = "2";
  rpc.call.mockResolvedValue(bad);
  await expect(relay().blitzRoster(key)).rejects.toThrow();
});
