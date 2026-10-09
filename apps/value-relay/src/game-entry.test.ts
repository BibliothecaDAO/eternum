import { Effect } from "effect";
import { expect, it, vi } from "vitest";
import { paidGameEntry } from "./game-entry";
vi.mock("@realms-world/value-ledger", () => ({ rpcAt: () => ({ getChainId: async () => "0x534e5f5345504f4c4941" }) }));
it("names the actual ledger L2 chain, configured fee token and exact native game key", async () => {
  expect(
    await Effect.runPromise(paidGameEntry("https://ledger.test", "0x10", "0x20", { chainId: "0x99", gameId: 7 })),
  ).toEqual({
    kind: "paid",
    ledger: { address: "0x10", chainId: "0x534e5f5345504f4c4941", feeToken: "0x20", shard: "0x99", gameId: 7 },
  });
  await expect(
    Effect.runPromise(paidGameEntry("https://ledger.test", "0x10", "", { chainId: "0x99", gameId: 7 })),
  ).rejects.toThrow();
});
