vi.mock("../../../packages/value-ledger/src/shard-abi", () => ({
  readShardAbi: async () => [{ type: "interface", items: [{ name: "deposit_source" }] }],
}));
import { beforeEach, expect, it, vi } from "vitest";
import { memoryFinalFacts } from "./final-facts";
import { sweepFrontierLords, frontierSettlementEvidence } from "./frontier-sweep";
import { ResourcesIds, RESOURCE_PRECISION } from "@bibliothecadao/types";
import type { ConfirmedSnapshot } from "./shard-snapshot";

const calls = vi.hoisted(() => ({
  admin: vi.fn(),
  funding: vi.fn(),
  ledgerHead: vi.fn(),
  finalHead: vi.fn(),
  header: vi.fn(),
  snapshot: vi.fn(),
  games: vi.fn(),
  settle: vi.fn(),
}));
vi.mock("@realms-world/value-ledger", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger")>()),
  rpcAt: vi.fn(),
  readFrontierFunding: calls.funding,
  readConfirmedLedgerHead: calls.ledgerHead,
  readFinalLedgerHead: calls.finalHead,
}));
vi.mock("@realms-world/value-ledger/shard", () => ({
  ShardOperator: class {
    admin = calls.admin;
  },
}));
vi.mock("./shard-rpc", async (original) => ({
  ...(await original<typeof import("./shard-rpc")>()),
  ShardReader: class {
    header = calls.header;
  },
}));
vi.mock("./frontier-games", () => ({ readFrontierGames: calls.games, frontierTerms: () => ({ end: 100 }) }));
vi.mock("./shard-snapshot", async (original) => ({
  ...(await original<typeof import("./shard-snapshot")>()),
  readConfirmedSnapshot: calls.snapshot,
}));
const target = {
  chainId: "0x1",
  rpcUrl: "https://shard.test",
  gamesAddress: "0x10",
  firstRelease: 1,
  accountAddress: "0x20",
  privateKey: "0x1",
};
let ledger = { rpcUrl: "https://ledger.test", address: "0x30", finals: memoryFinalFacts() };
const wei = (amount: number) => String(BigInt(amount) * 10n ** 18n);
const run = () => sweepFrontierLords(target, "https://herald.test", ledger, calls.settle);
const balance = (entity_id: number, amount: number, resource_type = ResourcesIds.Lords) => ({
  entity_id,
  balance: String(BigInt(amount) * BigInt(RESOURCE_PRECISION)),
  resource_type,
});
const receipt = (claim_id: number, amount: number, prize_rank = 0) => ({
  claim_id: `0x${claim_id.toString(16)}`,
  amount,
  account: "0x8",
  prize_rank,
  prize_count: prize_rank ? 1 : 0,
});
let state: ConfirmedSnapshot;
const rows = (model: string, values: Record<string, unknown>[]) => {
  state.models.find((row) => row.model === model)!.rows = values.map((value, index) => ({
    key: String(index),
    value: { game_id: 7, ...value },
  }));
};
beforeEach(() => {
  vi.resetAllMocks();
  ledger = { ...ledger, finals: memoryFinalFacts() };
  calls.ledgerHead.mockResolvedValue({ number: 10, time: 100 });
  calls.finalHead.mockResolvedValue({ number: 9, hash: "0xf", time: 90 });
  state = {
    confirmed_block: 10,
    game_id: "7",
    models: ["LordsBudget", "FrontierPrize", "ResourceBalance", "LordsWithdrawal"].map((model) => ({
      model,
      rows: [],
    })),
  };
  rows("LordsBudget", [{ pool: "700", pool_left: "600" }]);
  rows("FrontierPrize", [{ pool: "300", issued: "300", count: 1 }]);
  rows("ResourceBalance", [balance(9, 40), balance(3, 60), balance(8, 0), balance(2, 50, ResourcesIds.Wheat)]);
  rows("LordsWithdrawal", [receipt(101, 300, 1)]);
  calls.games.mockResolvedValue({ confirmedBlock: 10, games: [{ game_id: 7, clock: { end_at: 100 } }] });
  calls.header.mockResolvedValue({ timestamp: 100 });
  calls.snapshot.mockImplementation(async () => structuredClone(state));
  calls.funding.mockResolvedValue({
    claimDeadline: 604900,
    closed: false,
    pool: wei(700),
    prizePool: wei(300),
    paid: "0",
    prizePaid: wei(300),
  });
});

it("sweeps each nonempty LORDS balance once per tick in separate transactions, without an early close", async () => {
  await run();
  expect(calls.admin.mock.calls).toEqual([
    ["sweep_lords", { game_id: 7, structure_id: "3" }],
    ["sweep_lords", { game_id: 7, structure_id: "9" }],
  ]);
  expect(calls.settle).not.toHaveBeenCalled();
});
it("recovers a crash after the first debit from confirmed balances and closes only after both receipts are paid", async () => {
  calls.admin.mockImplementation(async (_command, args) => {
    if (args.structure_id === "9") throw new Error("offline");
    rows("ResourceBalance", [balance(9, 40)]);
    rows("LordsWithdrawal", [receipt(101, 300, 1), receipt(102, 60)]);
  });
  await expect(run()).rejects.toThrow("offline");
  calls.admin.mockImplementation(async () => {
    rows("ResourceBalance", []);
    rows("LordsWithdrawal", [receipt(101, 300, 1), receipt(102, 60), receipt(103, 40)]);
  });
  await run();
  expect(calls.admin.mock.calls.at(-1)).toEqual(["sweep_lords", { game_id: 7, structure_id: "9" }]);
  await run();
  expect(calls.settle).not.toHaveBeenCalled();
  calls.funding.mockResolvedValue({
    claimDeadline: 604900,
    closed: false,
    pool: wei(700),
    prizePool: wei(300),
    paid: wei(100),
    prizePaid: wei(300),
  });
  await run();
  expect(calls.settle.mock.calls).toEqual([
    [{ chainId: "0x1", gameId: 7, chestWithdrawn: wei(100), prizeWithdrawn: wei(300) }],
  ]);
  calls.funding.mockResolvedValue({ closed: true });
  await run();
  expect(calls.settle).toHaveBeenCalledTimes(1);
});
it("never sweeps a live season or a closed ledger", async () => {
  calls.header.mockResolvedValueOnce({ timestamp: 99 });
  await run();
  calls.funding.mockResolvedValue({ closed: true });
  await run();
  expect(calls.admin).not.toHaveBeenCalled();
  expect(calls.settle).not.toHaveBeenCalled();
});
it("does not use the shard clock to expire held claims before the L2 deadline", async () => {
  calls.header.mockResolvedValue({ timestamp: 100 + 7 * 24 * 60 * 60 });
  rows("LordsBudget", [{ pool: "700", pool_left: "300" }]);
  rows("ResourceBalance", [balance(3, 400)]);
  await run();
  expect(calls.admin.mock.calls).toEqual([["sweep_lords", { game_id: 7, structure_id: "3" }]]);
  expect(calls.settle).not.toHaveBeenCalled();
  rows("ResourceBalance", []);
  rows("LordsWithdrawal", [receipt(101, 300, 1), receipt(102, 400)]);
  await run();
  expect(calls.settle).not.toHaveBeenCalled();
  calls.funding.mockResolvedValue({
    claimDeadline: 604900,
    closed: false,
    pool: wei(700),
    prizePool: wei(300),
    paid: wei(400),
    prizePaid: wei(300),
  });
  await run();
  expect(calls.settle.mock.calls).toEqual([
    [{ chainId: "0x1", gameId: 7, chestWithdrawn: wei(400), prizeWithdrawn: wei(300) }],
  ]);
});
it.each(["old block", "before end"])(
  "refuses a snapshot %s even when the latest head is past the end",
  async (reason) => {
    if (reason === "old block") state.confirmed_block = 9;
    else calls.header.mockImplementation(async (block) => ({ timestamp: block === "latest" ? 100 : 99 }));
    await expect(run()).rejects.toThrow("frontier_sweep_snapshot_before_end");
    expect(calls.admin).not.toHaveBeenCalled();
    expect(calls.settle).not.toHaveBeenCalled();
  },
);
it("bounds each tick and resumes the next realms from the new snapshot", async () => {
  rows(
    "ResourceBalance",
    Array.from({ length: 27 }, (_, i) => balance(i + 1, 1)),
  );
  calls.admin.mockImplementation(async (_command, args) => {
    const model = state.models.find((row) => row.model === "ResourceBalance")!;
    model.rows = model.rows.filter(({ value }) => String(value.entity_id) !== args.structure_id);
  });
  await run();
  expect(calls.admin).toHaveBeenCalledTimes(25);
  await run();
  expect(calls.admin.mock.calls.slice(-2)).toEqual([
    ["sweep_lords", { game_id: 7, structure_id: "26" }],
    ["sweep_lords", { game_id: 7, structure_id: "27" }],
  ]);
});
it("does not let an unavailable old season prevent another sweep", async () => {
  calls.games.mockResolvedValue({
    confirmedBlock: 10,
    games: [
      { game_id: 6, clock: { end_at: 90 } },
      { game_id: 7, clock: { end_at: 100 } },
    ],
  });
  calls.snapshot.mockRejectedValueOnce(new Error("old season unreadable"));
  await expect(run()).rejects.toThrow("old season unreadable");
  expect(calls.admin).toHaveBeenCalledWith("sweep_lords", { game_id: 7, structure_id: "3" });
});
it("never closes with unposted or unfinished prizes", async () => {
  rows("ResourceBalance", []);
  rows("FrontierPrize", [{ pool: "300", issued: "0", count: null }]);
  rows("LordsWithdrawal", [receipt(102, 100)]);
  await run();
  rows("LordsWithdrawal", [receipt(102, 100), receipt(101, 150, 1)]);
  rows("FrontierPrize", [{ pool: "300", issued: "150", count: 2 }]);
  await run();
  expect(calls.settle).not.toHaveBeenCalled();
});
it("returns an unclaimed prize reserve to treasury only after the confirmed L2 deadline", async () => {
  rows("ResourceBalance", []);
  rows("LordsWithdrawal", []);
  rows("LordsBudget", [{ pool: "700", pool_left: "700" }]);
  rows("FrontierPrize", [{ pool: "300", issued: "0", count: 0 }]);
  calls.funding.mockResolvedValue({
    claimDeadline: 604900,
    closed: false,
    pool: wei(700),
    prizePool: wei(300),
    paid: "0",
    prizePaid: "0",
  });
  await run();
  expect(calls.settle).not.toHaveBeenCalled();
  calls.ledgerHead.mockResolvedValue({ number: 11, time: 604900 });
  await run();
  expect(calls.settle).toHaveBeenCalledWith({ chainId: "0x1", gameId: 7, chestWithdrawn: "0", prizeWithdrawn: "0" });
});
it("refuses missing chest receipts rather than returning their money to treasury", async () => {
  rows("ResourceBalance", []);
  await expect(run()).rejects.toThrow("frontier_sweep_receipts_differ");
  expect(calls.settle).not.toHaveBeenCalled();
});
it("refuses duplicate receipts and mismatched custody", async () => {
  rows("ResourceBalance", []);
  rows("LordsWithdrawal", [receipt(101, 300, 1), receipt(102, 50), receipt(102, 50)]);
  await expect(run()).rejects.toThrow("invalid_withdrawal_snapshot");
  calls.funding.mockResolvedValue({ closed: false, pool: wei(701), prizePool: wei(300) });
  await expect(run()).rejects.toThrow("frontier_sweep_funding_differs");
  expect(calls.settle).not.toHaveBeenCalled();
});

it("refuses unsafe JSON balances and duplicate zero-balance rows before sending", async () => {
  rows("ResourceBalance", [{ ...balance(3, 1), balance: Number.MAX_SAFE_INTEGER + 1 }]);
  await expect(run()).rejects.toThrow("unsafe_snapshot_integer");
  rows("ResourceBalance", [balance(3, 0), balance(3, 1)]);
  await expect(run()).rejects.toThrow("frontier_sweep_duplicate_balance");
  expect(calls.admin).not.toHaveBeenCalled();
  expect(calls.settle).not.toHaveBeenCalled();
});

it("closes a chest-only season without waiting for a nonexistent prize list", async () => {
  rows("ResourceBalance", []);
  rows("LordsWithdrawal", [receipt(102, 100)]);
  rows("FrontierPrize", [{ pool: "0", issued: "0", count: null }]);
  calls.funding.mockResolvedValue({ closed: false, pool: wei(700), prizePool: "0", paid: wei(100), prizePaid: "0" });
  await run();
  expect(calls.settle).toHaveBeenCalledWith({
    chainId: "0x1",
    gameId: 7,
    chestWithdrawn: wei(100),
    prizeWithdrawn: "0",
  });
});

it("leaves fractional custody dust for treasury settlement, matching whole-LORDS publication", async () => {
  rows("ResourceBalance", []);
  rows("LordsWithdrawal", [receipt(101, 300, 1), receipt(102, 100)]);
  calls.funding.mockResolvedValue({
    claimDeadline: 604900,
    closed: false,
    pool: String(BigInt(wei(700)) + 1n),
    prizePool: String(BigInt(wei(300)) + 1n),
    paid: wei(100),
    prizePaid: wei(300),
  });
  await run();
  expect(calls.settle).toHaveBeenCalledWith({
    chainId: "0x1",
    gameId: 7,
    chestWithdrawn: wei(100),
    prizeWithdrawn: wei(300),
  });
});

it("expires unpaid receipts only at the confirmed L2 deadline after every realm is swept", async () => {
  calls.ledgerHead.mockResolvedValue({ number: 10, time: 604900 });
  await run();
  expect(calls.admin).toHaveBeenCalledTimes(2);
  expect(calls.settle).not.toHaveBeenCalled();
  rows("ResourceBalance", []);
  rows("LordsWithdrawal", [receipt(101, 300, 1), receipt(102, 100)]);
  calls.ledgerHead.mockResolvedValue({ number: 11, time: 604899 });
  await run();
  expect(calls.settle).not.toHaveBeenCalled();
  calls.ledgerHead.mockResolvedValue({ number: 12, time: 604900 });
  await run();
  expect(calls.settle).toHaveBeenCalledWith({
    chainId: "0x1",
    gameId: 7,
    chestWithdrawn: wei(100),
    prizeWithdrawn: wei(300),
  });
  expect(calls.funding).toHaveBeenLastCalledWith(undefined, "0x30", { chainId: "0x1", gameId: 7 }, { end: 100 }, 12);
});

it("independently audits early settlement against remaining balances and exact confirmed receipts", async () => {
  calls.funding.mockResolvedValue({
    claimDeadline: 604900,
    closed: false,
    pool: wei(700),
    prizePool: wei(300),
    paid: wei(100),
    prizePaid: wei(300),
  });
  const report = { chainId: "0x1", gameId: 7, chestWithdrawn: wei(100), prizeWithdrawn: wei(300) };
  rows("LordsWithdrawal", [receipt(101, 300, 1), receipt(102, 100)]);
  expect(await frontierSettlementEvidence(target, "https://herald.test", report, ledger, wei(600))).toContain(
    '"realms":["3","9"]',
  );
  rows("ResourceBalance", []);
  expect(await frontierSettlementEvidence(target, "https://herald.test", report, ledger, wei(600))).toBeNull();
  expect(await frontierSettlementEvidence(target, "https://herald.test", report, ledger, wei(599))).toBe(
    "settlement_funding_or_totals_differ",
  );
  expect(
    await frontierSettlementEvidence(
      target,
      "https://herald.test",
      { ...report, chestWithdrawn: "0" },
      ledger,
      wei(600),
    ),
  ).not.toBeNull();
  rows("FrontierPrize", [{ pool: "300", issued: "0", count: 0 }]);
  rows("LordsWithdrawal", [receipt(102, 100)]);
  expect(
    await frontierSettlementEvidence(
      target,
      "https://herald.test",
      { ...report, prizeWithdrawn: "0" },
      ledger,
      wei(600),
    ),
  ).not.toBeNull();
  expect(calls.admin).not.toHaveBeenCalled();
});

it("co-signs only L2 paid totals after the deadline and still checks funding and post-end state", async () => {
  rows("ResourceBalance", []);
  rows("LordsWithdrawal", [receipt(101, 300, 1), receipt(102, 100)]);
  const report = { chainId: "0x1", gameId: 7, chestWithdrawn: "0", prizeWithdrawn: wei(300) };
  expect(await frontierSettlementEvidence(target, "https://herald.test", report, ledger, wei(700))).not.toBeNull();
  calls.ledgerHead.mockResolvedValue({ number: 11, time: 604900 });
  expect(await frontierSettlementEvidence(target, "https://herald.test", report, ledger, wei(700))).toBeNull();
  expect(
    await frontierSettlementEvidence(
      target,
      "https://herald.test",
      { ...report, chestWithdrawn: wei(100) },
      ledger,
      wei(700),
    ),
  ).toBe("settlement_funding_or_totals_differ");
  calls.header.mockResolvedValue({ timestamp: 99 });
  expect(await frontierSettlementEvidence(target, "https://herald.test", report, ledger, wei(700))).toBe(
    "settlement_funding_or_totals_differ",
  );
  calls.header.mockResolvedValue({ timestamp: 100 });
  rows("LordsBudget", [{ pool: "701", pool_left: "601" }]);
  expect(await frontierSettlementEvidence(target, "https://herald.test", report, ledger, wei(700))).toBe(
    "settlement_funding_or_totals_differ",
  );
});

it("the existing end-of-season sweep includes a deposit-only realm", async () => {
  rows("ResourceBalance", []);
  rows("LordsWithdrawal", [receipt(101, 300, 1), receipt(102, 100)]);
  state.models.push(
    {
      model: "SpendLords",
      rows: [{ key: "7:0x8", value: { game_id: 7, account: "0x8", available: "40", consumed: "0", swept: "0" } }],
    },
    {
      model: "Structure",
      rows: [
        {
          key: "7:17",
          value: {
            game_id: 7,
            entity_id: "17",
            owner: "0x8",
            base: {
              troop_max_guard_count: 1,
              troop_max_explorer_count: 5,
              created_at: 1,
              category: 1,
              level: 1,
              starting_troops_granted: true,
            },
            resources_packed: "0",
            metadata: { realm_id: 0, order: 0, has_wonder: false, village_realm: "0", mine_kind: 0, deepest_depth: 0 },
          },
        },
      ],
    },
  );
  await run();
  expect(calls.admin).toHaveBeenCalledWith("sweep_lords", { game_id: 7, structure_id: "17" });
});

it("sweeps a mixed realm once and keeps principal payment outside reward conservation", async () => {
  const { structureSnapshot } = await import("../test-support/deposit-structure");
  rows("ResourceBalance", [balance(17, 100)]);
  state.models.push(
    {
      model: "SpendLords",
      rows: [{ key: "7:8", value: { game_id: 7, account: "0x8", available: "40", consumed: "10", swept: "0" } }],
    },
    { model: "Structure", rows: [{ key: "7:17", value: structureSnapshot("0x8") }] },
    { model: "PrincipalWithdrawal", rows: [] },
  );
  const pay = vi.fn();
  await sweepFrontierLords(target, "https://herald.test", ledger, calls.settle, pay);
  expect(calls.admin.mock.calls).toEqual([["sweep_lords", { game_id: 7, structure_id: "17" }]]);
  expect(pay).not.toHaveBeenCalled();
  rows("ResourceBalance", []);
  rows("SpendLords", [{ account: "0x8", available: "0", consumed: "10", swept: "40" }]);
  rows("PrincipalWithdrawal", [{ account: "0x8", amount: "40" }]);
  rows("LordsWithdrawal", [receipt(101, 300, 1), receipt(102, 100)]);
  calls.funding.mockResolvedValue({
    closed: false,
    pool: wei(700),
    prizePool: wei(300),
    paid: wei(100),
    prizePaid: wei(300),
    claimDeadline: 604900,
  });
  await sweepFrontierLords(target, "https://herald.test", ledger, calls.settle, pay);
  expect(pay).toHaveBeenCalledWith({ chainId: "0x1", gameId: 7, account: "8", amount: "40" });
  expect(calls.settle).toHaveBeenCalledWith({
    chainId: "0x1",
    gameId: 7,
    chestWithdrawn: wei(100),
    prizeWithdrawn: wei(300),
  });
});

it("continues principal sweeps and retries payments after reward closure and its deadline", async () => {
  const { structureSnapshot } = await import("../test-support/deposit-structure");
  calls.funding.mockResolvedValue({ closed: true, claimDeadline: 101 });
  calls.ledgerHead.mockResolvedValue({ number: 10, time: 999999 });
  state.models.push(
    {
      model: "SpendLords",
      rows: [{ key: "7:8", value: { game_id: 7, account: "0x8", available: "40", consumed: "0", swept: "0" } }],
    },
    { model: "Structure", rows: [{ key: "7:17", value: structureSnapshot("0x8") }] },
    { model: "PrincipalWithdrawal", rows: [] },
  );
  const pay = vi.fn().mockResolvedValue({ block: 9, hash: "0xf" });
  await sweepFrontierLords(target, "https://herald.test", ledger, calls.settle, pay);
  expect(calls.admin.mock.calls).toEqual([["sweep_lords", { game_id: 7, structure_id: "17" }]]);
  rows("SpendLords", [{ account: "0x8", available: "0", consumed: "0", swept: "40" }]);
  rows("PrincipalWithdrawal", [
    { account: "0x8", amount: "40" },
    { account: "0x9", amount: "20" },
  ]);
  pay.mockRejectedValueOnce(new Error("wallet unavailable"));
  await expect(sweepFrontierLords(target, "https://herald.test", ledger, calls.settle, pay)).rejects.toThrow(
    "wallet unavailable",
  );
  expect(pay).toHaveBeenCalledWith({ chainId: "0x1", gameId: 7, account: "9", amount: "20" });
  await sweepFrontierLords(target, "https://herald.test", ledger, calls.settle, pay);
  expect(pay).toHaveBeenCalledTimes(3);
  expect(pay.mock.calls.filter(([claim]) => claim.account === "9")).toHaveLength(1);
  expect(calls.settle).not.toHaveBeenCalled();
});

it("sweeps principal-only balances after end even when reward publication never succeeded", async () => {
  const { structureSnapshot } = await import("../test-support/deposit-structure");
  rows("LordsBudget", []);
  rows("FrontierPrize", []);
  rows("ResourceBalance", []);
  rows("LordsWithdrawal", []);
  state.models.push(
    {
      model: "SpendLords",
      rows: [{ key: "7:8", value: { game_id: 7, account: "0x8", available: "40", consumed: "0", swept: "0" } }],
    },
    { model: "Structure", rows: [{ key: "7:17", value: structureSnapshot("0x8") }] },
  );
  await expect(run()).rejects.toThrow("frontier_pool_unpublished");
  expect(calls.admin).toHaveBeenCalledWith("sweep_lords", { game_id: 7, structure_id: "17" });
  expect(calls.settle).not.toHaveBeenCalled();
});

it("closes eligible rewards despite an unavailable principal wallet, then retries principal after close", async () => {
  rows("ResourceBalance", []);
  rows("LordsWithdrawal", [receipt(101, 300, 1), receipt(102, 100)]);
  state.models.push({
    model: "PrincipalWithdrawal",
    rows: [{ key: "7:8", value: { game_id: 7, account: "0x8", amount: "40" } }],
  });
  calls.ledgerHead.mockResolvedValue({ number: 10, time: 604900 });
  const pay = vi.fn().mockRejectedValueOnce(new Error("principal_wallet_unavailable")).mockResolvedValue(undefined);
  await expect(sweepFrontierLords(target, "https://herald.test", ledger, calls.settle, pay)).rejects.toThrow(
    "principal_wallet_unavailable",
  );
  expect(calls.settle).toHaveBeenCalledWith({
    chainId: "0x1",
    gameId: 7,
    chestWithdrawn: wei(100),
    prizeWithdrawn: wei(300),
  });
  calls.funding.mockResolvedValue({ closed: true });
  await sweepFrontierLords(target, "https://herald.test", ledger, calls.settle, pay);
  expect(pay).toHaveBeenCalledTimes(2);
  expect(calls.settle).toHaveBeenCalledTimes(1);
});

const principalCase = () => {
  state.models.push({
    model: "PrincipalWithdrawal",
    rows: [{ key: "7:8", value: { game_id: 7, account: "0x8", amount: "40" } }],
  });
  calls.funding.mockResolvedValue({ closed: true, claimDeadline: 101 });
};
it("keeps a principal as paid only with final evidence, and asks again while it is on the head only", async () => {
  principalCase();
  const pay = vi.fn().mockResolvedValue(null);
  for (let tick = 0; tick < 3; tick++)
    await sweepFrontierLords(target, "https://herald.test", ledger, calls.settle, pay);
  expect(pay).toHaveBeenCalledTimes(3);
  pay.mockResolvedValue({ block: 9, hash: "0xf" });
  await sweepFrontierLords(target, "https://herald.test", ledger, calls.settle, pay);
  for (let tick = 0; tick < 3; tick++)
    await sweepFrontierLords(target, "https://herald.test", ledger, calls.settle, pay);
  expect(pay).toHaveBeenCalledTimes(4);
});
it("keeps a season as closed only once the Ethereum-accepted block shows it closed", async () => {
  calls.funding.mockImplementation(async (_p, _a, _k, _t, block?: number) => ({
    closed: block === undefined || block === 10,
    claimDeadline: 101,
  }));
  for (let tick = 0; tick < 3; tick++) await run();
  // The sweep's head read and its read at the accepted block, every tick, until that block holds the closing.
  expect(calls.funding).toHaveBeenCalledTimes(6);
  calls.funding.mockImplementation(async () => ({ closed: true, claimDeadline: 101 }));
  await run();
  calls.funding.mockClear();
  await run();
  await run();
  expect(calls.funding).not.toHaveBeenCalled();
});
