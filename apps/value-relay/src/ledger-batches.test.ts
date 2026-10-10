import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { ledgerBatches } from "./ledger-batches";
const rpc = vi.hoisted(() => ({
  execute: vi.fn(),
  call: vi.fn(),
  wait: vi.fn(),
  records: new Map<string, string[]>(),
}));
vi.mock("@realms-world/value-ledger", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger")>()),
  rpcAt: () => ({
    getBlock: async () => ({ status: "ACCEPTED_ON_L2", block_number: 10, block_hash: "0xa", timestamp: 1000 }),
    callContract: rpc.call,
    waitForTransaction: rpc.wait,
  }),
}));
vi.mock("starknet", async (original) => ({
  ...(await original<typeof import("starknet")>()),
  Account: vi.fn(function (options: { signer?: { signRaw(hash: string): Promise<unknown> } }) {
    return {
      execute: async (calls: unknown) => {
        if (typeof options.signer === "object") await options.signer.signRaw("0xabc");
        return rpc.execute(calls);
      },
    };
  }),
}));
const credentials = {
  rpcUrl: "https://ledger.test",
  contractAddress: "0x10",
  accountAddress: "0x20",
  privateKey: `0x${Array.from(crypto.getRandomValues(new Uint8Array(31)), (v) => v.toString(16).padStart(2, "0")).join("")}`,
};
const claims = Array.from({ length: 100 }, (_, i) => ({
  chainId: "0x1",
  seasonId: 1,
  transactionHash: `0x${(i + 1).toString(16)}`,
  realmsId: "0x2",
  amount: "1",
  confirmedAt: 1,
}));
beforeEach(() => {
  vi.clearAllMocks();
  rpc.records.clear();
  rpc.call.mockImplementation(async (q) =>
    q.entrypoint === "get_frontier"
      ? ["1", "0", "2000", "1000", "0", "0", "0", "0", "1", "0x1"]
      : q.entrypoint === "frontier_unlocked"
        ? ["1000", "0"]
        : q.entrypoint === "is_paused"
          ? ["0"]
          : (rpc.records.get(q.calldata[1]) ?? ["0", "0", "0", "0", "0"]),
  );
  rpc.execute.mockImplementation(async (raw) => {
    for (const call of Array.isArray(raw) ? raw : [raw])
      if (call.entrypoint === "report_withdrawal")
        rpc.records.set(call.calldata[2], ["0", call.calldata[1], "0", call.calldata[3], call.calldata[4]]);
    return { transaction_hash: "0xabc" };
  });
  rpc.wait.mockResolvedValue({ isReverted: () => false });
});
it("reports a full page in one confirmed transaction and pays it in a separate multicall", async () => {
  const journal = vi.fn(async () => {});
  const batch = ledgerBatches(credentials, journal);
  expect((await Effect.runPromise(batch.reportMany(claims))).every((row) => row.error === null)).toBe(true);
  expect(rpc.execute).toHaveBeenCalledOnce();
  expect(rpc.execute.mock.calls[0]![0]).toHaveLength(100);
  await Effect.runPromise(batch.payMany(claims.map((withdrawal) => ({ withdrawal, wallet: "0x123" }))));
  expect(rpc.execute).toHaveBeenCalledTimes(2);
  expect(rpc.execute.mock.calls[1]![0]).toHaveLength(100);
  expect(journal).toHaveBeenCalledWith(
    expect.arrayContaining([expect.objectContaining({ claimId: "0x1", transactionHash: "0xabc", wallet: "0x123" })]),
  );
  expect(journal.mock.invocationCallOrder[0]).toBeLessThan(rpc.execute.mock.invocationCallOrder[1]!);
});
it("keeps confirmed reports when a pay reverts and retries unlock exhaustion", async () => {
  const batch = ledgerBatches(credentials, async () => {});
  await Effect.runPromise(batch.reportMany(claims.slice(0, 2)));
  rpc.wait.mockResolvedValue({ isReverted: () => true, revert_reason: "Ledger: unlock exceeded" });
  const paid = await Effect.runPromise(
    batch.payMany(claims.slice(0, 2).map((withdrawal) => ({ withdrawal, wallet: "0x123" }))),
  );
  expect(paid.every((row) => row.error === "ledger_unlock_exceeded")).toBe(true);
  expect(rpc.records.size).toBe(2);
});

it("pays only the available unlocked prefix and leaves excess claims retryable", async () => {
  const original = rpc.call.getMockImplementation()!;
  rpc.call.mockImplementation((q) =>
    q.entrypoint === "frontier_unlocked" ? Promise.resolve(["1", "0"]) : original(q),
  );
  const result = await Effect.runPromise(
    ledgerBatches(credentials, async () => {}).payMany(
      claims.slice(0, 2).map((withdrawal) => ({ withdrawal, wallet: "0x123" })),
    ),
  );
  expect(result).toContainEqual({ claimId: "0x1", error: null });
  expect(result).toContainEqual({ claimId: "0x2", error: "ledger_unlock_exceeded" });
});

it("isolates a permanently refused report while confirming every other debt", async () => {
  const original = rpc.execute.getMockImplementation()!;
  rpc.execute.mockImplementation(async (raw) => {
    const calls = Array.isArray(raw) ? raw : [raw];
    if (calls.some((call) => call.entrypoint === "report_withdrawal" && call.calldata[2] === "0x2"))
      throw new Error("Ledger: invalid withdrawal");
    return original(raw);
  });
  const result = await Effect.runPromise(ledgerBatches(credentials, async () => {}).reportMany(claims.slice(0, 3)));
  expect(result).toContainEqual({ claimId: "0x1", error: null });
  expect(result).toContainEqual({ claimId: "0x3", error: null });
  expect(result).toContainEqual({ claimId: "0x2", error: "ledger_invalid_withdrawal" });
});
