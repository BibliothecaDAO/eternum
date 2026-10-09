import { beforeEach, expect, it, vi } from "vitest";
import { accountLinkLedger } from "./account-link-ledger";
const rpc = vi.hoisted(() => ({ call: vi.fn(), block: vi.fn(), execute: vi.fn(), wait: vi.fn() }));
vi.mock("@realms-world/value-ledger", () => ({
  rpcAt: () => ({
    callContract: rpc.call,
    getBlock: rpc.block,
    waitForTransaction: rpc.wait,
    getChainId: async () => "0x1",
  }),
}));
vi.mock("starknet", () => ({
  Signer: class {
    async signRaw(_hash: string) {
      return ["0x1", "0x2"];
    }
  },
  Account: vi.fn(function (options: { signer: { signRaw(hash: string): Promise<string[]> } }) {
    return {
      execute: async (call: unknown) => {
        await options.signer.signRaw("0xabc");
        return rpc.execute(call);
      },
    };
  }),
}));
const ledger = () =>
  accountLinkLedger({
    rpcUrl: "https://ledger.test",
    contractAddress: "0x10",
    accountAddress: "0x20",
    privateKey: "unused-test-key",
  });
beforeEach(() => {
  vi.clearAllMocks();
  rpc.block.mockResolvedValue({ status: "ACCEPTED_ON_L2", block_number: 5 });
  rpc.call.mockImplementation(async (query) =>
    query.entrypoint === "account_of_wallet" ? ["0x20"] : query.entrypoint === "wallet_of_account" ? ["0x10"] : ["0x1"],
  );
  rpc.execute.mockResolvedValue({ transaction_hash: "0xabc" });
  rpc.wait.mockResolvedValue({ isReverted: () => false });
});
it("reads both scalar views at one confirmed head and uses exactly the published setter", async () => {
  expect(await ledger().read("0x10", "0x20")).toEqual({ wallet: "0x10", account: "0x20" });
  expect(rpc.call.mock.calls.map((call) => call[1])).toEqual([5, 5]);
  const receipt = vi.fn(async () => {});
  expect(await ledger().set("0x10", "0x20", receipt)).toEqual({
    transactionHash: "0xabc",
    wallet: "0x10",
    account: "0x20",
    previousAccount: "0x20",
    previousWallet: "0x10",
  });
  expect(rpc.execute).toHaveBeenCalledWith({
    contractAddress: "0x10",
    entrypoint: "set_account_link",
    calldata: ["0x10", "0x20"],
  });
  expect(receipt).toHaveBeenCalledWith(expect.objectContaining({ transactionHash: "0xabc" }));
  expect(receipt.mock.invocationCallOrder[0]).toBeLessThan(rpc.execute.mock.invocationCallOrder[0]!);
  expect(rpc.wait).not.toHaveBeenCalled();
  expect(await ledger().confirm("0xabc")).toBe(true);
});
it("refuses provisional reads and distinguishes a reverted broadcast from an unknown receipt", async () => {
  rpc.block.mockResolvedValue({ block_number: 5 });
  await expect(ledger().read("0x10", "0x20")).rejects.toThrow();
  rpc.wait.mockResolvedValue({ isReverted: () => true });
  expect(await ledger().confirm("0xabc")).toBe(false);
  rpc.wait.mockRejectedValue(new Error("unavailable"));
  await expect(ledger().confirm("0xabc")).rejects.toThrow();
});
