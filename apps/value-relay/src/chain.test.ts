import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { ledgerPaymentAdapter, ledgerPaymentRead, ledgerReportAdapter, ledgerPauserAdapter } from "./chain";

const rpc = vi.hoisted(() => ({ execute: vi.fn(), call: vi.fn(), wait: vi.fn(), block: vi.fn() }));
vi.mock("starknet", async (importOriginal) => ({
  ...(await importOriginal<typeof import("starknet")>()),
  RpcProvider: vi.fn(function () {
    return { callContract: rpc.call, waitForTransaction: rpc.wait, getBlock: rpc.block };
  }),
  Account: vi.fn(function (options: { signer?: { signRaw(hash: string): Promise<unknown> } }) {
    return {
      execute: async (call: unknown) => {
        if (typeof options.signer === "object") await options.signer.signRaw("0xabc");
        return rpc.execute(call);
      },
    };
  }),
}));
const credentials = {
  rpcUrl: "https://ledger.test",
  contractAddress: "0x10",
  accountAddress: "0x20",
  privateKey: `0x${Array.from(crypto.getRandomValues(new Uint8Array(31)), (value) => value.toString(16).padStart(2, "0")).join("")}`,
};
beforeEach(() => {
  vi.clearAllMocks();
  rpc.block.mockResolvedValue({ status: "ACCEPTED_ON_L2", block_number: 10, block_hash: "0xa", timestamp: 1000 });
  rpc.execute.mockResolvedValue({ transaction_hash: "0xabc" });
  rpc.wait.mockResolvedValue({ isReverted: () => false });
});
it("waits for the Frontier payment to confirm before completing", async () => {
  await Effect.runPromise(
    ledgerPaymentAdapter(credentials, async () => {})(
      { chainId: "0x1", seasonId: 7, transactionHash: "0xdef", realmsId: "0x3", amount: "17", confirmedAt: 1000 },
      "0x456",
    ),
  );
  expect(rpc.execute).toHaveBeenCalledWith({
    contractAddress: "0x10",
    entrypoint: "pay",
    calldata: ["0x1", "7", "0xdef", "0x456", "17", "0"],
  });
  expect(rpc.wait).toHaveBeenCalledWith("0xabc", { errorStates: [] });
});
it("does not mark a reverted payment successful or expose a transport's error", async () => {
  const pay = ledgerPaymentAdapter(credentials, async () => {});
  const withdrawal = {
    chainId: "0x1",
    seasonId: 7,
    transactionHash: "0xdef",
    realmsId: "0x3",
    amount: "17",
    confirmedAt: 1000,
  };
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

it("distinguishes a permanent close from the retryable whole-day unlock gate without leaking revert text", async () => {
  const claim = {
    chainId: "0x1",
    seasonId: 7,
    transactionHash: "0xdef",
    realmsId: "0x3",
    amount: "17",
    confirmedAt: 1000,
  };
  const pay = ledgerPaymentAdapter(credentials, async () => {});
  rpc.wait.mockResolvedValue({ isReverted: () => true, revert_reason: "Ledger: season closed" });
  await expect(Effect.runPromise(pay(claim, "0x456"))).rejects.toMatchObject({ operation: "ledger_season_closed" });
  rpc.wait.mockResolvedValue({ isReverted: () => true, revert_reason: "Ledger: unlock exceeded" });
  await expect(Effect.runPromise(pay(claim, "0x456"))).rejects.toMatchObject({ operation: "ledger_unlock_exceeded" });
});

it("confirms an immutable withdrawal report separately from payment and recognizes reported-unpaid versus unseen", async () => {
  const claim = {
    chainId: "0x1",
    seasonId: 7,
    transactionHash: "0xdef",
    realmsId: "0x3",
    amount: "17",
    confirmedAt: 1000,
  };
  rpc.call.mockResolvedValueOnce(["0", "0", "0", "0", "0"]);
  expect(await Effect.runPromise(ledgerPaymentRead(credentials.rpcUrl, credentials.contractAddress)(claim))).toBeNull();
  rpc.call.mockResolvedValueOnce(["0", "0", "0", "0", "0"]).mockResolvedValue(["0", "7", "0", "17", "0"]);
  await Effect.runPromise(ledgerReportAdapter(credentials)(claim));
  expect(rpc.execute).toHaveBeenCalledWith({
    contractAddress: "0x10",
    entrypoint: "report_withdrawal",
    calldata: ["0x1", "7", "0xdef", "17", "0"],
  });
  expect(await Effect.runPromise(ledgerPaymentRead(credentials.rpcUrl, credentials.contractAddress)(claim))).toEqual({
    paid: false,
    seasonId: 7,
    wallet: "0",
    amount: "17",
  });
  await expect(Effect.runPromise(ledgerReportAdapter(credentials)({ ...claim, amount: "18" }))).rejects.toMatchObject({
    operation: "ledger_report_mismatch",
  });
  expect(rpc.execute).toHaveBeenCalledTimes(1);
});

it("refuses a pay before broadcast when identity cannot record ready authority", async () => {
  const record = vi.fn(async () => {
    throw new Error("not_ready");
  });
  const pay = ledgerPaymentAdapter(credentials, record);
  await expect(
    Effect.runPromise(
      pay(
        { chainId: "0x1", seasonId: 1, transactionHash: "0xabc", realmsId: "0x2", amount: "1", confirmedAt: 1 },
        "0x123",
      ),
    ),
  ).rejects.toMatchObject({ operation: "pay Frontier claim" });
  expect(rpc.execute).not.toHaveBeenCalled();
});
it("journals the exact signed claim decision before broadcast without an inclusion clock", async () => {
  const record = vi.fn(async () => {});
  await Effect.runPromise(
    ledgerPaymentAdapter(credentials, record)(
      { chainId: "0x1", seasonId: 1, transactionHash: "0xdef", realmsId: "0x2", amount: "17", confirmedAt: 999999 },
      "0x123",
    ),
  );
  expect(record).toHaveBeenCalledWith({
    chainId: "0x1",
    seasonId: 1,
    claimId: "0xdef",
    realmsId: "0x2",
    amount: "17",
    wallet: "0x123",
    transactionHash: "0xabc",
  });
  expect(record.mock.invocationCallOrder[0]).toBeLessThan(rpc.execute.mock.invocationCallOrder[0]!);
  expect(rpc.block).not.toHaveBeenCalled();
});

it("sets aside a first report that permanently missed the ledger claim window", async () => {
  rpc.call.mockResolvedValue(["0", "0", "0", "0", "0"]);
  rpc.wait.mockResolvedValue({ isReverted: () => true, revert_reason: "Ledger: claim window ended" });
  await expect(
    Effect.runPromise(
      ledgerReportAdapter(credentials)({
        chainId: "0x1",
        seasonId: 7,
        transactionHash: "0xdef",
        realmsId: "0x3",
        amount: "17",
        confirmedAt: 1000,
      }),
    ),
  ).rejects.toMatchObject({ operation: "ledger_claim_window_ended" });
});
