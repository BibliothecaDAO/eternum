import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { ledgerPaymentAdapter, ledgerPauserAdapter, realmsOwnershipAdapter } from "./chain";

const rpc = vi.hoisted(() => ({ execute: vi.fn(), call: vi.fn(), wait: vi.fn() }));
vi.mock("starknet", () => ({
  RpcProvider: vi.fn(function () {
    return { callContract: rpc.call, waitForTransaction: rpc.wait };
  }),
  Account: vi.fn(function () {
    return { execute: rpc.execute };
  }),
}));
const credentials = {
  rpcUrl: "https://ledger.test",
  contractAddress: "0x10",
  accountAddress: "0x20",
  privateKey: "unused-test-key",
};
beforeEach(() => {
  vi.clearAllMocks();
  rpc.execute.mockResolvedValue({ transaction_hash: "0xabc" });
  rpc.wait.mockResolvedValue({ isReverted: () => false });
});
it("waits for the Frontier payment to confirm before completing", async () => {
  await Effect.runPromise(
    ledgerPaymentAdapter(credentials)(
      { chainId: "0x1", seasonId: 7, transactionHash: "0xdef", realmsId: "0x3", amount: "17" },
      "0x456",
    ),
  );
  expect(rpc.execute).toHaveBeenCalledWith({
    contractAddress: "0x10",
    entrypoint: "pay",
    calldata: ["0x1", "7", "0xdef", "0x456", "17", "0"],
  });
  expect(rpc.wait).toHaveBeenCalledWith("0xabc");
});
it("does not mark a reverted payment successful or expose a transport's error", async () => {
  const pay = ledgerPaymentAdapter(credentials);
  const withdrawal = { chainId: "0x1", seasonId: 7, transactionHash: "0xdef", realmsId: "0x3", amount: "17" };
  rpc.wait.mockResolvedValue({ isReverted: () => true });
  await expect(Effect.runPromise(pay(withdrawal, "0x456"))).rejects.toMatchObject({ operation: "pay Frontier claim" });
  rpc.wait.mockRejectedValue(new Error("sensitive transport detail"));
  await expect(Effect.runPromise(pay(withdrawal, "0x456"))).rejects.toMatchObject({ operation: "pay Frontier claim" });
});
it("makes a monitor pause retry harmless once the pause already landed", async () => {
  rpc.call.mockResolvedValue(["0x1"]);
  await Effect.runPromise(ledgerPauserAdapter(credentials)());
  expect(rpc.execute).not.toHaveBeenCalled();
  rpc.call.mockResolvedValue(["0x0"]);
  await Effect.runPromise(ledgerPauserAdapter(credentials)());
  expect(rpc.execute).toHaveBeenCalledWith({ contractAddress: "0x10", entrypoint: "pause", calldata: [] });
  expect(rpc.wait).toHaveBeenCalledWith("0xabc");
});
it("reads live Realm ownership at latest confirmed with u256 input", async () => {
  rpc.call.mockResolvedValue(["0x123"]);
  expect(
    await Effect.runPromise(realmsOwnershipAdapter("https://ledger.test", "0x30").ownerOf(String(2n ** 128n + 4n))),
  ).toBe("0x123");
  expect(rpc.call).toHaveBeenCalledWith(
    { contractAddress: "0x30", entrypoint: "owner_of", calldata: ["4", "1"] },
    "latest",
  );
});
