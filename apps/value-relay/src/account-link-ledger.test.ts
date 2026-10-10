import { beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { hash } from "starknet";
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
vi.mock("starknet", async (importOriginal) => ({
  ...(await importOriginal<typeof import("starknet")>()),
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
    privateKey: `0x${hash.starknetKeccak(crypto.randomUUID()).toString(16)}`,
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

it("binds setter, views and displacement decoding to the landed ledger interface", () => {
  const source = readFileSync(new URL("../../../contracts/l2/ledger/src/contract.cairo", import.meta.url), "utf8");
  const contractInterface = source.split("#[starknet::interface]")[1]!;
  expect(contractInterface).toContain(
    "fn set_account_link(ref self: TState, wallet: ContractAddress, account: ContractAddress);",
  );
  expect(contractInterface).toContain(
    "fn account_of_wallet(self: @TState, wallet: ContractAddress) -> ContractAddress;",
  );
  expect(contractInterface).toContain(
    "fn wallet_of_account(self: @TState, account: ContractAddress) -> ContractAddress;",
  );
  const event = source.match(/struct AccountLinkChanged \{([^}]+)\}/)![1]!;
  expect(
    event.match(/(?:#\[key\]\s+)?\w+: ContractAddress/g)?.map((field) => field.replace(/\s+/g, " ").trim()),
  ).toEqual([
    "#[key] wallet: ContractAddress",
    "#[key] account: ContractAddress",
    "previous_account: ContractAddress",
    "previous_wallet: ContractAddress",
  ]);
});
