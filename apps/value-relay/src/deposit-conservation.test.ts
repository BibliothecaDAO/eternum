import { beforeEach, expect, it, vi } from "vitest";
import { auditDepositLedger, auditDeposits, DepositConservationFault } from "./deposit-conservation";
import { checkDepositRetirement } from "./deposit-retirement";
import { depositCommitment, LORDS_UNIT, type LordsDeposit } from "@realms-world/value-ledger/deposits";
const mocks = vi.hoisted(() => ({ read: vi.fn(), snapshot: vi.fn(), rpc: vi.fn() }));
vi.mock("@realms-world/value-ledger", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger")>()),
  rpcAt: () => ({
    callContract: mocks.rpc,
    getChainId: async () => "0x2",
    getBlock: async () => ({ block_number: 10, block_hash: "0xa", timestamp: 3000, status: "ACCEPTED_ON_L2" }),
  }),
}));
vi.mock("@realms-world/value-ledger/deposits", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger/deposits")>()),
  depositReader: async () => reader,
}));
vi.mock("./shard-snapshot", async (original) => ({
  ...(await original<typeof import("./shard-snapshot")>()),
  readConfirmedSnapshot: mocks.snapshot,
}));
vi.mock("./frontier-games", () => ({ readFrontierGames: async () => ({ games: [{ game_id: 7 }] }) }));
vi.mock("./shard-rpc", () => ({
  ShardReader: class {
    async header() {
      return { block_number: 10, block_hash: "0xa", timestamp: 3000 };
    }
  },
}));
vi.mock("../../../packages/value-ledger/src/shard-abi", () => ({
  readShardAbi: async () => [{ type: "interface", items: [{ name: "deposit_source" }, { name: "deposit_count" }] }],
}));
const ledger = { rpcUrl: "https://ledger.test", chainId: "0x1", address: "0x10" };
const shard = {
  rpcUrl: "https://source.test",
  chainId: "0x2",
  gamesAddress: "0x20",
  firstRelease: 1,
  heraldUrl: "https://herald.test",
};
const source: LordsDeposit = {
  shard: "0x2",
  id: "1",
  gameId: 7,
  games: "0x20",
  account: "0x30",
  realmsId: "0x77",
  home: "17",
  payer: "0x33",
  amount: "100",
  paidAt: "999",
  status: "delivered",
};
let payments: LordsDeposit[],
  paid: { wallet: string; amount: string } | null,
  balances: Record<string, unknown>[],
  receipts: Record<string, unknown>[],
  withdrawals: Record<string, unknown>[],
  end: number;
const reader = {
  head: { number: 50, hash: "0x50", time: 3000 },
  assertCanonical: async () => {},
  read: mocks.read,
  count: async (chain: string) => BigInt(payments.filter((payment) => BigInt(payment.shard) === BigInt(chain)).length),
  deposit: async (chain: string, id: string) =>
    payments.find((payment) => BigInt(payment.shard) === BigInt(chain) && payment.id === id)!,
  principal: async () => paid,
};
beforeEach(() => {
  vi.clearAllMocks();
  payments = [{ ...source }];
  paid = { wallet: "0x88", amount: "60" };
  end = 2000;
  balances = [{ game_id: 7, account: "0x30", available: "0", consumed: "40", swept: "60" }];
  withdrawals = [{ game_id: 7, account: "0x30", amount: "60" }];
  receipts = [
    {
      game_id: 7,
      id: "1",
      commitment: depositCommitment({ chainId: ledger.chainId, ledger: ledger.address }, source),
      account: "0x30",
      amount: "100",
      cancelled: false,
    },
  ];
  mocks.read.mockImplementation(async (method, args) => {
    if (method === "deposit_target_count") return ["1"];
    if (method === "deposit_target_at") return ["0x2", "7"];
    if (method === "deposit_target") return ["0x20"];
    if (method === "deposit_principal")
      return [
        String(payments.reduce((sum, p) => sum + BigInt(p.amount) * LORDS_UNIT, 0n)),
        "0",
        String(
          payments.filter((p) => p.status === "cancelled").reduce((sum, p) => sum + BigInt(p.amount) * LORDS_UNIT, 0n),
        ),
        "0",
        String(BigInt(paid?.amount ?? 0) * LORDS_UNIT),
        "0",
      ];
    if (method === "lords") return ["0x99"];
    if (method === "get_frontier")
      return ["1", "1", String(end), "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"];
    throw new Error(`unexpected:${method}`);
  });
  mocks.rpc.mockResolvedValue([String(100n * LORDS_UNIT), "0"]);
  mocks.snapshot.mockImplementation(async (_shard, _url, _game, models: string[]) => ({
    confirmed_block: 10,
    game_id: "7",
    models: models.map((model) => ({
      model,
      rows: (model === "DepositSource"
        ? [{ chain: "0x1", ledger: "0x10" }]
        : model === "GameRegistry"
          ? [{ end_at: end }]
          : model === "DepositReceipt"
            ? receipts
            : model === "SpendLords"
              ? balances
              : model === "PrincipalWithdrawal"
                ? withdrawals
                : []
      ).map((value) => ({ value })),
    })),
  }));
});
it("reconciles principal returns and undelivered refunds without including reward balances", async () => {
  expect(await auditDepositLedger(ledger)).toMatchObject({ principal: "40", returned: "60" });
  payments.push({ ...source, id: "2", amount: "20", status: "cancelled" });
  expect(await auditDepositLedger(ledger)).toMatchObject({ principal: "40", returned: "60" });
  expect(mocks.snapshot).not.toHaveBeenCalled();
  mocks.rpc.mockResolvedValue([String(39n * LORDS_UNIT), "0"]);
  await expect(auditDepositLedger(ledger)).rejects.toBeInstanceOf(DepositConservationFault);
});
it("detects principal returned above delivered receipts", async () => {
  paid = { wallet: "0x88", amount: "101" };
  await expect(auditDepositLedger(ledger)).rejects.toThrow("principal_return_exceeds_delivery");
});
it("compares every native debit with the L2 principal return", async () => {
  expect(await auditDeposits(shard, shard.heraldUrl, ledger)).toMatchObject([
    { available: "0", consumed: "40", swept: "60", unpaidPrincipal: 0 },
  ]);
  paid = { wallet: "0x88", amount: "61" };
  await expect(auditDeposits(shard, shard.heraldUrl, ledger)).rejects.toThrow("principal_return_mismatch");
});
it("defers a snapshot predating delivery rather than passing an empty balance audit", async () => {
  receipts = [];
  balances = [];
  withdrawals = [];
  await expect(auditDeposits(shard, shard.heraldUrl, ledger)).rejects.toThrow("deposit_receipt_snapshot_pending");
  await expect(checkDepositRetirement({ shard, ledger })).rejects.toThrow("deposit_receipt_snapshot_pending");
});
it("refuses a live enabled season even when nobody deposited", async () => {
  payments = [];
  receipts = [];
  balances = [];
  withdrawals = [];
  paid = null;
  end = 4000;
  await expect(checkDepositRetirement({ shard, ledger })).rejects.toThrow("deposit_ingress_still_live");
});
it("requires every unused principal payment before retiring source state", async () => {
  expect(await checkDepositRetirement({ shard, ledger })).toMatchObject({ retirementReady: true, receipts: "1" });
  paid = null;
  await expect(checkDepositRetirement({ shard, ledger })).rejects.toThrow("principal_return_pending");
  withdrawals = [];
  balances = [{ ...balances[0], available: "60", swept: "0" }];
  await expect(checkDepositRetirement({ shard, ledger })).rejects.toThrow("principal_return_pending");
});
it("defers a snapshot predating a principal payment", async () => {
  balances = [{ ...balances[0], available: "60", swept: "0" }];
  withdrawals = [];
  await expect(auditDeposits(shard, shard.heraldUrl, ledger)).rejects.toThrow("principal_snapshot_pending");
});
it("allows fully consumed deposits to retire without inventing a payout", async () => {
  paid = null;
  withdrawals = [];
  balances = [{ ...balances[0], consumed: "100", swept: "0" }];
  expect(await checkDepositRetirement({ shard, ledger })).toMatchObject({ retirementReady: true });
});
