import { Effect } from "effect";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ledgerApprovals } from "./ledger-approvals";
import { runMonitor, type MonitorProgress } from "./monitor";
import { RelayFailure, type MonitorPorts, type ReportedClaim } from "./ports";

const rpc = vi.hoisted(() => ({ call: vi.fn(), execute: vi.fn(), wait: vi.fn(), block: vi.fn() }));
vi.mock("starknet", async (original) => ({
  ...(await original<typeof import("starknet")>()),
  RpcProvider: vi.fn(function () {
    return { callContract: rpc.call, waitForTransaction: rpc.wait, getBlock: rpc.block };
  }),
  Account: vi.fn(function () {
    return { execute: rpc.execute };
  }),
}));
beforeEach(() => {
  vi.resetAllMocks();
  rpc.block.mockResolvedValue({ status: "ACCEPTED_ON_L2", block_number: 10, block_hash: "0xa", timestamp: 1000 });
  rpc.wait.mockResolvedValue({ isReverted: () => false });
});
afterEach(() => vi.restoreAllMocks());

const fixture = (stream: "payment" | "settlement") => {
  const report: ReportedClaim = {
    chainId: "0x1",
    seasonId: 7,
    transactionHash: "0xabc",
    reportTransactionHash: "0xdef",
    wallet: "0x123",
    amount: "6000",
    prizeRank: 0,
    prizeCount: 0,
  };
  const settlement = { chainId: "0x1", gameId: 7, chestWithdrawn: "6000", prizeWithdrawn: "3" };
  const state = {
    approved: false,
    paid: false,
    closed: false,
    missing: false,
    wallet: report.wallet,
    amount: report.amount,
    chest: settlement.chestWithdrawn,
    ready: "2000",
  };
  rpc.call.mockImplementation(async ({ entrypoint }: { entrypoint: string }) => {
    if (entrypoint === "get_payment")
      return state.missing
        ? Array(8).fill("0")
        : [String(Number(state.paid)), "7", state.wallet, state.amount, "0", "0", "0", "1000"];
    if (entrypoint === "get_frontier")
      return ["1", "1", "2", "9999", "0", "0", "0", String(Number(state.closed)), "1", "0", "3", "0", "0", "0"];
    if (entrypoint === "get_settlement") return [state.chest, "0", "3", "0", state.ready];
    if (entrypoint === "payment_approved" || entrypoint === "settlement_approved")
      return [String(Number(state.approved))];
    throw new Error(`unexpected read ${entrypoint}`);
  });
  rpc.execute.mockImplementation(async () => {
    state.approved = true;
    return { transaction_hash: "0x456" };
  });
  const approvals = ledgerApprovals({
    rpcUrl: "https://ledger.test",
    contractAddress: "0x10",
    accountAddress: "0x20",
    privateKey: "0x30",
  });
  const page = <T>(rows: T[]) =>
    Effect.succeed({ rows, next: null, head: 10, fromBlock: 1, anchor: { number: 10, hash: "0xa" }, rewind: false });
  let forged = false;
  let progress: MonitorProgress = { halted: null };
  const ports: MonitorPorts = {
    identity: { matchesPayDecision: () => Effect.succeed(true) },
    shard: {
      withdrawalReceipt: (_chain, hash) =>
        hash === "0xbad"
          ? Effect.fail(new RelayFailure({ operation: "receipt_unavailable" }))
          : Effect.succeed({
              ...report,
              transactionHash: hash,
              amount: forged ? "1" : report.amount,
              account: "0x4",
              confirmedAt: 1,
            }),
      withdrawal: () => Effect.succeed({ ...report, realmsId: "0x3", confirmedAt: 1 }),
      settlementEvidence: (row) =>
        row.gameId === 8
          ? Effect.fail(new RelayFailure({ operation: "herald_unavailable" }))
          : Effect.succeed(forged ? "forged_totals" : null),
      conservation: () => Effect.succeed([]),
      result: () => Effect.succeed(null),
    },
    ledger: {
      ...approvals,
      pause: vi.fn(() => Effect.void),
      frontierPool: () => Effect.succeed("0"),
      reportedClaims: () => page(stream === "payment" ? [{ ...report, transactionHash: "0xbad" }, report] : []),
      reportedSettlements: () => page(stream === "settlement" ? [{ ...settlement, gameId: 8 }, settlement] : []),
      paidClaims: () => page([]),
      postedResults: () => page([]),
    },
  };
  const store = {
    load: async () => progress,
    save: async (value: MonitorProgress) => {
      progress = value;
    },
  };
  return {
    state,
    report,
    settlement,
    approvals,
    ports,
    store,
    forge: () => {
      forged = true;
    },
    tick: () => Effect.runPromise(runMonitor(ports, store)),
    approve: () =>
      Effect.runPromise(
        stream === "payment" ? approvals.approvePayment(report) : approvals.approveSettlement(settlement),
      ),
  };
};

it.each(["payment", "settlement"] as const)(
  "retries a %s page without resubmitting healthy approvals and still detects a forgery",
  async (stream) => {
    const f = fixture(stream);
    const time = vi.spyOn(Date, "now");
    for (const seconds of [1000, 1060, 1120]) {
      time.mockReturnValue(seconds * 1000);
      await expect(f.tick()).rejects.toBeInstanceOf(RelayFailure);
    }
    expect(rpc.execute).toHaveBeenCalledTimes(1);
    expect(f.ports.ledger.pause).not.toHaveBeenCalled();
    expect(
      (await f.store.load()).cursors?.[stream === "payment" ? "reportedClaims" : "reportedSettlements"],
    ).toBeUndefined();
    f.forge();
    await expect(f.tick()).resolves.toMatchObject({
      halted: stream === "payment" ? "reported_claim_mismatch:0xabc" : "reported_settlement_mismatch:7",
    });
    expect(rpc.execute).toHaveBeenCalledTimes(1);
    expect(f.ports.ledger.pause).toHaveBeenCalledOnce();
    expect(rpc.call.mock.calls.every(([, block]) => block === 10)).toBe(true);
  },
);

it.each(["payment", "settlement"] as const)(
  "recovers a landed %s approval after a lost acknowledgment without resubmitting",
  async (stream) => {
    const f = fixture(stream);
    rpc.wait.mockRejectedValueOnce(new Error("receipt response lost"));
    await expect(f.approve()).rejects.toBeInstanceOf(RelayFailure);
    await f.approve();
    expect(rpc.execute).toHaveBeenCalledTimes(1);
  },
);

it.each(["payment", "settlement"] as const)(
  "retries a failed %s submission when no approval landed",
  async (stream) => {
    const f = fixture(stream);
    rpc.execute.mockRejectedValueOnce(new Error("broadcast failed"));
    await expect(f.approve()).rejects.toBeInstanceOf(RelayFailure);
    await f.approve();
    expect(rpc.execute).toHaveBeenCalledTimes(2);
  },
);

it("skips paid, voided, closed and superseded payment reports, but approves newly verified terms", async () => {
  const f = fixture("payment");
  for (const key of ["paid", "missing", "closed"] as const) {
    f.state[key] = true;
    await f.approve();
    f.state[key] = false;
  }
  f.state.wallet = "0x999";
  await f.approve();
  expect(rpc.execute).not.toHaveBeenCalled();
  f.report.wallet = f.state.wallet;
  await f.approve();
  expect(rpc.execute).toHaveBeenCalledTimes(1);
  // Voiding and recreating even identical terms clears the onchain approval.
  f.state.approved = false;
  await f.approve();
  expect(rpc.execute).toHaveBeenCalledTimes(2);
  f.state.amount = "7000";
  f.state.approved = false;
  await f.approve();
  expect(rpc.execute).toHaveBeenCalledTimes(2);
  f.report.amount = f.state.amount;
  await f.approve();
  expect(rpc.execute).toHaveBeenCalledTimes(3);
});

it("skips absent, closed and superseded settlements, but approves newly verified replacement terms", async () => {
  const f = fixture("settlement");
  f.state.ready = "0";
  await f.approve();
  f.state.ready = "2000";
  f.state.closed = true;
  await f.approve();
  f.state.closed = false;
  f.state.chest = "7000";
  await f.approve();
  expect(rpc.execute).not.toHaveBeenCalled();
  f.settlement.chestWithdrawn = f.state.chest;
  await f.approve();
  expect(rpc.execute).toHaveBeenCalledTimes(1);
  f.state.approved = false;
  await f.approve();
  expect(rpc.execute).toHaveBeenCalledTimes(2);
});

it.each(["payment", "settlement"] as const)(
  "withholds %s approval when current ledger state cannot be read",
  async (stream) => {
    const f = fixture(stream);
    rpc.call.mockRejectedValueOnce(new Error("RPC unavailable"));
    await expect(f.approve()).rejects.toBeInstanceOf(RelayFailure);
    expect(rpc.execute).not.toHaveBeenCalled();
  },
);

it.each(["payment", "settlement"] as const)(
  "refuses %s approval on an unconfirmed head or malformed approval flag",
  async (stream) => {
    const f = fixture(stream);
    rpc.block.mockResolvedValueOnce({ status: "PRE_CONFIRMED", block_number: 10, block_hash: "0xa", timestamp: 1000 });
    await expect(f.approve()).rejects.toBeInstanceOf(RelayFailure);
    const read = rpc.call.getMockImplementation()!;
    rpc.call.mockImplementation(async (call) => (call.entrypoint.endsWith("_approved") ? ["2"] : read(call)));
    await expect(f.approve()).rejects.toBeInstanceOf(RelayFailure);
    expect(rpc.execute).not.toHaveBeenCalled();
  },
);
