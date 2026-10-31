import { ledgerCall } from "../../../packages/value-ledger/test-support/ledger-abi";
import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { ledgerBatches } from "./ledger-batches";
const rpc = vi.hoisted(() => ({
  execute: vi.fn(),
  call: vi.fn(),
  wait: vi.fn(),
  time: 1000,
  records: new Map<string, string[]>(),
}));
vi.mock("@realms-world/value-ledger", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger")>()),
  rpcAt: () => ({
    getBlock: async () => ({ status: "ACCEPTED_ON_L2", block_number: 10, block_hash: "0xa", timestamp: rpc.time }),
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
  prizeRank: 0,
  prizeCount: 0,
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
  rpc.time = 1000;
  rpc.call.mockImplementation(async (q) =>
    q.entrypoint === "pay_delay"
      ? ["600"]
      : q.entrypoint === "get_frontier"
        ? ["1", "0", "2000", "1000", "0", "0", "0", "0", "1", "0x1", "0", "0", "0", "0"]
        : q.entrypoint === "frontier_unlocked"
          ? ["1000", "0"]
          : q.entrypoint === "is_paused"
            ? ["0"]
            : (rpc.records.get(q.calldata[1]) ?? ["0", "0", "0", "0", "0", "0", "0", "0"]),
  );
  rpc.execute.mockImplementation(async (raw) => {
    for (const call of Array.isArray(raw) ? raw : [raw])
      if (call.entrypoint === "report_withdrawal")
        rpc.records.set(call.calldata[2], [
          "0",
          call.calldata[1],
          "0",
          call.calldata[3],
          call.calldata[4],
          call.calldata[5],
          call.calldata[6],
          "0",
        ]);
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
  for (const [index, claim] of claims.entries()) {
    const args = {
      prize_rank: 0,
      prize_count: 0,
      shard: claim.chainId,
      season_id: claim.seasonId,
      claim_id: claim.transactionHash,
      amount: { low: claim.amount, high: 0 },
    };
    expect(rpc.execute.mock.calls[0]![0][index].calldata.map(BigInt)).toEqual(
      ledgerCall("report_withdrawal", args).map(BigInt),
    );
    expect(rpc.execute.mock.calls[1]![0][index].calldata.map(BigInt)).toEqual(
      ledgerCall("pay", { ...args, wallet: "0x123" }).map(BigInt),
    );
  }
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
  await Effect.runPromise(ledgerBatches(credentials, async () => {}).reportMany(claims.slice(0, 2)));
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

it.each(["get_frontier", "frontier_unlocked"])(
  "refuses a payment page when %s rejects absent custody",
  async (entrypoint) => {
    await Effect.runPromise(ledgerBatches(credentials, async () => {}).reportMany(claims.slice(0, 2)));
    rpc.execute.mockClear();
    const original = rpc.call.getMockImplementation()!;
    rpc.call.mockImplementation(async (query) => {
      if (query.entrypoint === entrypoint) throw new Error("Ledger: unknown Frontier season");
      return original(query);
    });
    await expect(
      Effect.runPromise(
        ledgerBatches(credentials, async () => {}).payMany(
          claims.slice(0, 2).map((withdrawal) => ({ withdrawal, wallet: "0x123" })),
        ),
      ),
    ).rejects.toMatchObject({ operation: "pay Frontier withdrawal page" });
    expect(rpc.execute).not.toHaveBeenCalled();
  },
);

it("refuses unpaid prizes and chests once the season closes", async () => {
  const original = rpc.call.getMockImplementation()!;
  rpc.call.mockImplementation(async (q) =>
    q.entrypoint === "get_frontier"
      ? ["1", "0", "900", "1000", "0", "1000", "0", "1", "1", "0x1", "10", "0", "5", "0"]
      : original(q),
  );
  const prize = { ...claims[0]!, amount: "5", prizeRank: 1, prizeCount: 10 };
  const batch = ledgerBatches(credentials, async () => {});
  expect(await Effect.runPromise(batch.reportMany([prize]))).toEqual([{ claimId: "0x1", error: null }]);
  const result = await Effect.runPromise(
    batch.payMany([
      { withdrawal: prize, wallet: "0x123" },
      { withdrawal: { ...prize, transactionHash: "0x2", prizeRank: 2, amount: "1" }, wallet: "0x124" },
      { withdrawal: claims[2]!, wallet: "0x125" },
    ]),
  );
  expect(result).toContainEqual({ claimId: "0x1", error: "ledger_season_closed" });
  expect(result.every((row) => row.error !== null)).toBe(true);
  expect(rpc.execute).toHaveBeenCalledTimes(1);
});

it("keeps immature reports out of a payment batch without blocking mature claims", async () => {
  const batch = ledgerBatches(credentials, async () => {});
  await Effect.runPromise(batch.reportMany(claims.slice(0, 2)));
  rpc.records.get("0x2")![7] = "1000";
  rpc.execute.mockClear();
  const rows = claims.slice(0, 2).map((withdrawal) => ({ withdrawal, wallet: "0x123" }));
  expect(await Effect.runPromise(batch.payMany(rows))).toEqual(
    expect.arrayContaining([
      { claimId: "0x1", error: null },
      { claimId: "0x2", error: "ledger_payment_delay" },
    ]),
  );
  expect(rpc.execute).toHaveBeenCalledWith(
    expect.objectContaining({ entrypoint: "pay", calldata: expect.arrayContaining(["0x1"]) }),
  );
  rpc.time = 1600;
  expect(await Effect.runPromise(batch.payMany([rows[1]!]))).toEqual([{ claimId: "0x2", error: null }]);
});
