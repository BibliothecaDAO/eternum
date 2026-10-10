vi.mock("./environment", () => ({ ledgerAddress: () => "0x10" }));
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
const key = { chainId: "0x1", slotId: 7 };
const game = (start = "200") => ["1", "1", "1", start, "300", "0", "0", "0", "0"];
const relay = () =>
  new ValueRelay(
    {
      storage: { setAlarm: async () => {} },
      blockConcurrencyWhile: async (run: () => Promise<unknown>) => run(),
    } as unknown as DurableObjectState,
    {
      LEDGER_RPC_URL: "https://ledger.test",
      ENVIRONMENT: "staging",
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
  rpc.call.mockImplementation(async (request) => (request.entrypoint === "get_slot" ? game() : ["0x123", "0x456"]));
});
it("serves a confirmed closed empty slot through the chain guard", async () => {
  expect(await relay().registrations(key)).toMatchObject({
    blockNumber: 100,
    blockHash: "0xab",
    secondsUntilClose: 0,
    registrations: [],
    slot: { end: 300 },
  });
  expect(rpc.call.mock.calls.every((call) => call[1] === 100)).toBe(true);
});
it("refuses another L2 chain and provisional reads before fetching registrations", async () => {
  rpc.chain.mockResolvedValue("0x3");
  await expect(relay().registrations(key)).rejects.toThrow();
  expect(rpc.call).not.toHaveBeenCalled();
  rpc.chain.mockResolvedValue("0x2");
  rpc.block.mockResolvedValue({ timestamp: 200 });
  await expect(relay().registrations(key)).rejects.toThrow();
  expect(rpc.call).not.toHaveBeenCalled();
});
it("reports the ledger's close time and refuses an invalid cancellation flag", async () => {
  rpc.call.mockResolvedValue(game("290"));
  expect(await relay().registrations(key)).toMatchObject({ secondsUntilClose: 90, registrations: [] });
  const bad = game();
  bad[8] = "3";
  rpc.call.mockResolvedValue(bad);
  await expect(relay().registrations(key)).rejects.toThrow();
});
