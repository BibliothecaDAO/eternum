import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { paidGameEntry } from "./game-entry";
const rpc = vi.hoisted(() => ({ chain: vi.fn(), block: vi.fn(), call: vi.fn() }));
vi.mock("@realms-world/value-ledger", () => ({
  rpcAt: () => ({ getChainId: rpc.chain, getBlock: rpc.block, callContract: rpc.call }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  rpc.chain.mockResolvedValue("0x534e5f5345504f4c4941");
  rpc.call.mockRejectedValue(new Error("token reads belong to the client"));
});
it("publishes only the ledger and game identity without resolving token facts", async () => {
  expect(await Effect.runPromise(paidGameEntry("https://ledger.test", "0x10", { chainId: "0x99", gameId: 7 }))).toEqual(
    {
      kind: "paid",
      ledger: { address: "0x10", chainId: "0x534e5f5345504f4c4941", shard: "0x99", gameId: 7 },
    },
  );
  expect(rpc.call).not.toHaveBeenCalled();
  expect(rpc.block).not.toHaveBeenCalled();
});
it("refuses an unavailable or invalid ledger chain instead of publishing entry terms", async () => {
  rpc.chain.mockRejectedValueOnce(new Error("unavailable"));
  await expect(
    Effect.runPromise(paidGameEntry("https://ledger.test", "0x10", { chainId: "0x99", gameId: 7 })),
  ).rejects.toThrow();
  rpc.chain.mockResolvedValue("0x0");
  await expect(
    Effect.runPromise(paidGameEntry("https://ledger.test", "0x10", { chainId: "0x99", gameId: 7 })),
  ).rejects.toThrow();
});
