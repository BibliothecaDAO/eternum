import { structureSnapshot } from "../test-support/deposit-structure";
import { beforeEach, expect, it, vi } from "vitest";
import { durableFinalFacts } from "./final-facts";
import { relayDeposits, depositHistory, type DepositRelayPorts } from "./deposits";
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
const storage: DepositRelayPorts["storage"] = {
  get: async <T>(key: string) => structuredClone(saved.get(key)) as T | undefined,
  put: async (key: string, value: unknown) => {
    saved.set(key, structuredClone(value));
  },
  delete: async (key: string) => saved.delete(key),
  transaction: async <A>(run: (tx: typeof storage) => Promise<A>) => run(storage),
  list: async <T>({
    prefix,
    reverse,
    limit,
    end,
  }: {
    prefix: string;
    reverse?: boolean;
    limit?: number;
    end?: string;
  }) => {
    const keys = [...saved.keys()].filter((key) => key.startsWith(prefix) && (!end || key < end)).sort();
    if (reverse) keys.reverse();
    return new Map(keys.slice(0, limit).map((key) => [key, structuredClone(saved.get(key)) as T]));
  },
};
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
  storage,
  finals: durableFinalFacts(storage),
  obligations: storage,
  proofs: false,
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
            ? [{ value: { start_main_at: 1, end_at: ended ? 999 : 2000 } }]
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
    error: [{ obligation: "deposit:2:1", error: "lost settlement response" }],
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
it("reuses the persisted anchor and keeps every discovered deposit as work until it is settled", async () => {
  rows = Array.from({ length: 45 }, (_, index) => ({ ...payment, id: String(index + 1) }));
  mocks.receipt.mockRejectedValue(new Error("unavailable"));
  await relayDeposits(ports);
  await relayDeposits(ports);
  await relayDeposits(ports);
  expect(mocks.reader).toHaveBeenCalledWith(expect.anything(), "0x10", "0x1", { number: 50, hash: "0x50", time: 1000 });
  const progress = [...saved.values()].find((value) => (value as { open?: string[] }).open) as {
    next: string;
    open: string[];
  };
  expect(progress.next).toBe("46");
  expect(new Set(progress.open).size).toBe(45);
});

it("a pass reads the count once and each new deposit once, then only the count however many deposits there are", async () => {
  const reads = {
    count: vi.fn(async () => BigInt(rows.length)),
    deposit: vi.fn(async (_s: string, id: string) => rows[Number(id) - 1]),
  };
  mocks.reader.mockImplementation(async () => ({
    assertCanonical: mocks.canonical,
    head: { number: 50, hash: "0x50", time: 1000 },
    ...reads,
  }));
  rows = Array.from({ length: 30 }, (_, index) => ({
    ...payment,
    id: String(index + 1),
    status: "delivered" as const,
  }));
  await relayDeposits(ports);
  expect(reads.count).toHaveBeenCalledTimes(1);
  const first = reads.deposit.mock.calls.length;
  reads.count.mockClear();
  reads.deposit.mockClear();
  await relayDeposits(ports);
  await relayDeposits(ports);
  // Twenty new deposits a pass, each read once to be stored with its history row and once by its attempt: the next pass
  // does the last ten, and the one after reads nothing but the count.
  expect([first, reads.count.mock.calls.length, reads.deposit.mock.calls.length]).toEqual([40, 2, 20]);
});

const history = (realmsId: string, before?: string) => depositHistory(ports, realmsId, before);
it("serves a player's deposit history from what the relay read, with no chain read, and updates a status when it acts", async () => {
  await relayDeposits(ports);
  mocks.reader.mockClear();
  expect((await history("0x77")).rows.map(({ id, status }) => [id, status])).toEqual([["1", "delivered"]]);
  expect((await history("0x78")).rows).toEqual([]);
  expect(mocks.reader).not.toHaveBeenCalled();
});
it("pages the history newest first, 50 deposits a page, and finds the player's deposits among others'", async () => {
  rows = Array.from({ length: 70 }, (_, index) => ({
    ...payment,
    id: String(index + 1),
    realmsId: index % 2 ? "0x77" : "0x88",
    status: "delivered" as const,
  }));
  for (let pass = 0; pass < 4; pass++) await relayDeposits(ports);
  const first = await history("0x77");
  expect(first.rows.map(({ id }) => id)).toEqual(Array.from({ length: 25 }, (_, index) => String(70 - 2 * index)));
  expect(first.next).toBe("20");
  const second = await history("0x77", first.next!);
  expect(second.rows.map(({ id }) => id)).toEqual(Array.from({ length: 10 }, (_, index) => String(20 - 2 * index)));
  expect(second.next).toBeNull();
});
it("keeps the history of deposits discovered before it was kept, reading each once", async () => {
  rows = Array.from({ length: 3 }, (_, index) => ({ ...payment, id: String(index + 1), status: "delivered" as const }));
  saved.set("deposits:1:16:progress", { next: "4", pending: [] });
  const reads = vi.fn(async (_shard: string, id: string) => rows[Number(id) - 1]);
  mocks.reader.mockImplementation(async () => ({
    assertCanonical: mocks.canonical,
    head: { number: 50, hash: "0x50", time: 1000 },
    count: async () => 3n,
    deposit: reads,
  }));
  await relayDeposits(ports);
  expect((await history("0x77")).rows.map(({ id }) => id)).toEqual(["3", "2", "1"]);
  expect(reads).toHaveBeenCalledTimes(3);
  await relayDeposits(ports);
  await relayDeposits(ports);
  expect(reads).toHaveBeenCalledTimes(3);
});
