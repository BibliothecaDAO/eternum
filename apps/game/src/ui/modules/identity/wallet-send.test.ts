import type { AccountInterface, ProviderInterface } from "starknet";
import { expect, it, vi } from "vitest";

import { sendFromWallet, WrongWalletError } from "./wallet-send";

const CALLS = [{ contractAddress: "0x1ed9e7", entrypoint: "register", calldata: [] }];

const wallet = () => {
  const execute = vi.fn(async () => ({ transaction_hash: "0xtx" }));
  return { account: { address: "0x4a1", execute } as unknown as AccountInterface, execute };
};

const chain = (strk: bigint, receipt: Promise<object>) =>
  ({
    callContract: vi.fn(async () => [String(strk), "0"]),
    waitForTransaction: vi.fn(() => receipt),
  }) as unknown as ProviderInterface;

it("sends from the owner only, and offers the swap instead of sending when it holds no STRK for the fee", async () => {
  const { account, execute } = wallet();
  const landed = Promise.resolve({ isReverted: () => false });
  await expect(sendFromWallet(account, "0x999", CALLS, chain(1n, landed), vi.fn())).rejects.toBeInstanceOf(
    WrongWalletError,
  );
  const empty = chain(0n, landed);
  await expect(sendFromWallet(account, "0x4a1", CALLS, empty, vi.fn())).resolves.toEqual({ kind: "no-strk" });
  expect(execute).not.toHaveBeenCalled();
  // The fee balance is read on the network's own fee token, STRK, never on a token a service names.
  expect(empty.callContract).toHaveBeenCalledWith({
    contractAddress: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
    entrypoint: "balance_of",
    calldata: ["0x4a1"],
  });
});

it("holds a sent call until its receipt lands, and answers a revert with the ledger's own reason", async () => {
  const { account } = wallet();
  const signed = vi.fn();
  const landed = sendFromWallet(
    account,
    "0x04a1",
    CALLS,
    chain(1n, Promise.resolve({ isReverted: () => false })),
    signed,
  );
  await expect(landed).resolves.toEqual({ kind: "landed" });
  expect(signed).toHaveBeenCalledOnce();
  const reverted = {
    isReverted: () => true,
    revert_reason:
      "Error in the called contract (0x1ed9e7):\nExecution failed. Failure reason: 'Ledger: already registered'.",
  };
  await expect(sendFromWallet(account, "0x4a1", CALLS, chain(1n, Promise.resolve(reverted)), vi.fn())).resolves.toEqual(
    {
      kind: "refused",
      reason: "Ledger: already registered",
    },
  );
});

it("says the network did not confirm a send whose receipt could not be read, never that it was not sent", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { account } = wallet();
  const outcome = await sendFromWallet(account, "0x4a1", CALLS, chain(1n, Promise.reject(new Error("503"))), vi.fn());
  expect(outcome).toEqual({ kind: "refused", reason: "The network did not confirm it. Check again in a moment." });
});
