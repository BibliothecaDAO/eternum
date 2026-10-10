import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { paidGameEntry } from "./game-entry";
const rpc = vi.hoisted(() => ({ block: vi.fn(), call: vi.fn() }));
vi.mock("@realms-world/value-ledger", () => ({
  rpcAt: () => ({ getChainId: async () => "0x534e5f5345504f4c4941", getBlock: rpc.block, callContract: rpc.call }),
}));
beforeEach(() => {
  rpc.block.mockResolvedValue({ status: "ACCEPTED_ON_L2", block_number: 10 });
  rpc.call.mockResolvedValue(["0x20"]);
});
it("takes the token actually charged from lords() at the confirmed ledger head", async () => {
  expect(await Effect.runPromise(paidGameEntry("https://ledger.test", "0x10", { chainId: "0x99", gameId: 7 }))).toEqual(
    {
      kind: "paid",
      ledger: { address: "0x10", chainId: "0x534e5f5345504f4c4941", feeToken: "0x20", shard: "0x99", gameId: 7 },
    },
  );
  expect(rpc.call).toHaveBeenCalledWith({ contractAddress: "0x10", entrypoint: "lords", calldata: [] }, 10);
});
it("refuses unavailable, malformed and provisional token facts", async () => {
  for (const fields of [[], ["0x0"], ["0x20", "0x21"]]) {
    rpc.call.mockResolvedValue(fields);
    await expect(
      Effect.runPromise(paidGameEntry("https://ledger.test", "0x10", { chainId: "0x99", gameId: 7 })),
    ).rejects.toThrow();
  }
  rpc.block.mockResolvedValue({ block_number: 10 });
  await expect(
    Effect.runPromise(paidGameEntry("https://ledger.test", "0x10", { chainId: "0x99", gameId: 7 })),
  ).rejects.toThrow();
});
