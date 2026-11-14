import { structureSnapshot } from "../test-support/deposit-structure";
import { beforeEach, expect, it, vi } from "vitest";
import { relayDeposits, type DepositRelayPorts } from "./deposits";
import { DepositAnchorError, depositCommitment, type LordsDeposit } from "@realms-world/value-ledger/deposits";
import { realmsAccountAddress } from "../../../packages/identity/src/account";
const mocks = vi.hoisted(() => ({
  receipt: vi.fn(),
  admin: vi.fn(),
  snapshot: vi.fn(),
  reader: vi.fn(),
  canonical: vi.fn(),
}));
vi.mock("../../../packages/value-ledger/src/shard-abi", () => ({
  readShardAbi: async () => [{ type: "interface", items: [{ name: "deposit_source" }] }],
}));
vi.mock("@realms-world/value-ledger", () => ({
  rpcAt: () => ({
    getChainId: async () => "0x2",
    getBlock: async () => ({ block_number: 10, block_hash: "0x10", timestamp: 1000, status: "ACCEPTED_ON_L2" }),
    callContract: async ({ entrypoint }: { entrypoint: string }) =>
      entrypoint === "realms_id" ? ["0x77"] : ["0x11", "0x22"],
  }),
}));
vi.mock("@realms-world/value-ledger/deposits", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger/deposits")>()),
  depositReader: mocks.reader,
}));
vi.mock("@realms-world/value-ledger/shard", () => ({
  ShardOperator: class {
    provider = { callContract: mocks.receipt };
    async head() {
      return { block_number: 10, block_hash: "0x10" };
    }
    admin = mocks.admin;
  },
}));
vi.mock("./shard-rpc", () => ({
  ShardReader: class {
    async header() {
      return { timestamp: 1000, block_number: 10 };
    }
  },
}));
vi.mock("./frontier-games", () => ({
  readFrontierGames: async () => ({ games: [{ game_id: 7, clock: { end_at: 2000 } }] }),
}));
vi.mock("./shard-snapshot", async (original) => ({
  ...(await original<typeof import("./shard-snapshot")>()),
  readConfirmedSnapshot: mocks.snapshot,
}));
const account = realmsAccountAddress("0x77", "0x11", "0x22");
const payment: LordsDeposit = {
  shard: "0x2",
  id: "1",
  gameId: 7,
  games: "0x20",
  account,
  realmsId: "0x77",
  home: "17",
  payer: "0x33",
  amount: "40",
  paidAt: "999",
  status: "pending",
};
let delivered: Map<string, boolean>,
  ended = false,
  category = 1;
let rows: LordsDeposit[];
let saved: Map<string, unknown>;
const sign = vi.fn(async (_request: unknown) => ({ r: "0x1", s: "0x2" }));
const mutate = vi.fn<DepositRelayPorts["mutate"]>();
const ports: DepositRelayPorts = {
  target: {
    chainId: "0x2",
    gamesAddress: "0x20",
    rpcUrl: "https://shard.test",
    firstRelease: 1,
    accountAddress: "0x5",
    privateKey: "0x6",
  },
  heraldUrl: "https://herald.test",
  ledger: { rpcUrl: "https://ledger.test", address: "0x10", chainId: "0x1" },
  storage: {
    get: async <T>(key: string) => structuredClone(saved.get(key)) as T | undefined,
    put: async (key, value) => {
      saved.set(key, structuredClone(value));
    },
  },
  sign,
  mutate,
};
beforeEach(() => {
  vi.clearAllMocks();
  delivered = new Map();
  ended = false;
  category = 1;
  saved = new Map();
  rows = [{ ...payment }];
  mocks.canonical.mockResolvedValue(undefined);
  mocks.reader.mockImplementation(async () => ({
    assertCanonical: mocks.canonical,
    head: { number: 50, hash: "0x50", time: 1000 },
    count: async () => BigInt(rows.length),
    deposit: async (_shard: string, id: string) => rows[Number(id) - 1],
  }));
  mocks.snapshot.mockImplementation(async (_target, _url, _game, models: string[]) => ({
    confirmed_block: 10,
    game_id: "7",
    models: models.map((model) => ({
      model,
      rows:
        model === "DepositSource"
          ? [{ value: { chain: "0x1", ledger: "0x10" } }]
          : model === "GameRegistry"
            ? [{ value: { start_main_at: 1, scheduled_end_at: ended ? 999 : 2000, end_at: ended ? 999 : 2000 } }]
            : model === "Structure"
              ? [{ value: structureSnapshot(account, category) }]
              : [],
    })),
  }));
  mocks.receipt.mockImplementation(async ({ calldata }) => {
    const id = calldata[1],
      value = rows[Number(id) - 1]!;
    return !delivered.has(id)
      ? ["1"]
      : [
          "0",
          depositCommitment({ chainId: "0x1", ledger: "0x10" }, value),
          account,
          "40",
          delivered.get(id) ? "0" : "1",
        ];
  });
  mocks.admin.mockImplementation(async (_method, args) => {
    delivered.set(args.deposit.id, !args.cancel);
    return { transactionHash: "0x1", events: [] };
  });
  mutate.mockImplementation(async (request) => {
    if (request.kind === "resolve")
      rows[Number(request.id) - 1]!.status = request.cancelled ? "cancelled" : "delivered";
  });
});
it("persists a failed resolution and recovers without issuing a second credit", async () => {
  mutate.mockRejectedValueOnce(new Error("lost settlement response"));
  expect(await relayDeposits(ports)).toMatchObject({
    processed: 0,
    pending: 1,
    error: [{ obligation: "deposit:1", error: "lost settlement response" }],
  });
  expect(mocks.admin).toHaveBeenCalledTimes(1);
  expect(await relayDeposits(ports)).toMatchObject({ processed: 1, next: "2", more: false, pending: 0 });
  expect(mocks.admin).toHaveBeenCalledTimes(1);
  expect(rows[0]!.status).toBe("delivered");
  await relayDeposits(ports);
  expect(mocks.admin).toHaveBeenCalledTimes(1);
});
it.each(["ended", "non-Realm"])(
  "cancels a known invalid %s destination through signed cancellation before refund",
  async (invalid) => {
    if (invalid === "ended") ended = true;
    else category = 2;
    const result = await relayDeposits(ports);
    expect(result).toMatchObject({ processed: 1, error: null });
    expect(sign).toHaveBeenCalledWith({ kind: "deposit", shard: "0x2", season: 7, id: "1", cancel: true });
    expect(mocks.admin).toHaveBeenCalledWith("deliver_deposit", expect.objectContaining({ cancel: true }));
    expect(mutate).toHaveBeenCalledWith({ kind: "resolve", shard: "0x2", id: "1", cancelled: true });
    expect(rows[0]!.status).toBe("cancelled");
  },
);
it("an unavailable receipt remains durable while later receipts proceed", async () => {
  rows.push({ ...payment, id: "2" });
  mocks.receipt.mockRejectedValueOnce(new Error("source unavailable"));
  expect(await relayDeposits(ports)).toMatchObject({ processed: 1, pending: 1, next: "3", more: true });
  expect(rows.map((row) => row.status)).toEqual(["pending", "delivered"]);
  expect(await relayDeposits(ports)).toMatchObject({ processed: 1, pending: 0, next: "3" });
  expect(rows.map((row) => row.status)).toEqual(["delivered", "delivered"]);
});
it("halts before signing or mutating when a durable anchor is rewritten", async () => {
  mocks.canonical.mockRejectedValue(new DepositAnchorError("deposit_head_rewritten"));
  await expect(relayDeposits(ports)).rejects.toThrow("deposit_head_rewritten");
  expect(sign).not.toHaveBeenCalled();
  expect(mutate).not.toHaveBeenCalled();
  expect(mocks.admin).not.toHaveBeenCalled();
});
it("reuses the persisted anchor and rotates a bounded backlog without losing any obligation", async () => {
  rows = Array.from({ length: 45 }, (_, index) => ({ ...payment, id: String(index + 1) }));
  mocks.receipt.mockRejectedValue(new Error("unavailable"));
  await relayDeposits(ports);
  await relayDeposits(ports);
  await relayDeposits(ports);
  expect(mocks.reader).toHaveBeenCalledWith(expect.anything(), "0x10", "0x1", { number: 50, hash: "0x50", time: 1000 });
  const progress = [...saved.values()][0] as { next: string; pending: string[] };
  expect(progress.next).toBe("46");
  expect(new Set(progress.pending).size).toBe(45);
  expect(progress.pending.slice(-20)).toEqual(Array.from({ length: 20 }, (_, index) => String(index + 21)));
});
