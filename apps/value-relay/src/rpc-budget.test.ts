vi.mock("./environment", async (original) => ({
  ...(await original<typeof import("./environment")>()),
  ledgerAddress: () => "0x10",
  ledgerContractOf: () => ({ contractAddress: "0x10", deploymentBlock: 1 }),
}));
import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { response } from "../../../packages/value-ledger/test-support/abi";
import { ledgerAbi } from "../../../packages/value-ledger/test-support/ledger-abi";
import { ValueRelay } from "./worker";
import { ValueMonitor } from "./monitor-worker";
import { ledgerMonitorReads } from "./ledger";
import { ledgerPaymentProof, ledgerPaymentRead } from "./chain";
import { releaseLine } from "../../../packages/core/src/test-support/releases";

vi.mock("cloudflare:workers", () => ({
  WorkerEntrypoint: class {},
  DurableObject: class {
    constructor(
      public ctx: unknown,
      public env: unknown,
    ) {}
  },
}));
vi.mock("./ledger-chain", () => ({
  onIdentityChain: (_url: unknown, _identity: unknown, operation: unknown) => operation,
}));
vi.mock("./chain", async (original) => ({
  ...(await original<typeof import("./chain")>()),
  ledgerPauserAdapter: () => vi.fn(),
}));
const shard = vi.hoisted(() => ({ games: vi.fn(), snapshot: vi.fn() }));
vi.mock("./shard-rpc", async (original) => ({
  ...(await original<typeof import("./shard-rpc")>()),
  ShardReader: class {
    header = async () => ({ timestamp: 100, block_number: 10 });
  },
}));
vi.mock("./frontier-games", () => ({ readFrontierGames: shard.games }));
vi.mock("./shard-snapshot", async (original) => ({
  ...(await original<typeof import("./shard-snapshot")>()),
  readConfirmedSnapshot: shard.snapshot,
}));

// ---- the fake transport --------------------------------------------------------------------------------------------

const FINAL = 90;
const chain = vi.hoisted(() => ({
  calls: new Map<string, number>(),
  head: 100,
  final: 90,
  /** Seasons are closed from this block on. */
  closedAt: 80,
}));
const count = (name: string) => chain.calls.set(name, (chain.calls.get(name) ?? 0) + 1);
const frontier = (closed: boolean) =>
  response(ledgerAbi, "get_frontier", {
    prize_pool: { low: 0, high: 0 },
    prize_paid: { low: 0, high: 0 },
    funded: true,
    start: 10,
    end: 100,
    pool: { low: 700n * 10n ** 18n, high: 0 },
    paid: { low: 0, high: 0 },
    closed,
    preset_id: 6,
    seed: 153,
  });
const preset = () =>
  response(ledgerAbi, "get_preset", {
    frontier_top_n: 10,
    frontier_chest_bps: 7000,
    entry_fee: { low: 0, high: 0 },
    protocol_cut_bps: 0,
    chest_lords_bps: 0,
    paid_fraction_bps: 0,
    decay_bps: 0,
    sword_price: { low: 0, high: 0 },
    shield_price: { low: 0, high: 0 },
    mmr: { enabled: false, mean: 0, spread: 0, max_delta: 0, k: 0, regression_bps: 0 },
    day_unit_seconds: 5,
    claim_window_seconds: 604800,
  });
const payment = (paid: boolean) =>
  response(ledgerAbi, "get_payment", {
    reported_at: 1,
    paid,
    season_id: 4,
    wallet: "0x123",
    amount: { low: 17, high: 0 },
    prize_rank: 0,
    prize_count: 0,
  });
vi.mock("@realms-world/value-ledger", async (original) => {
  const real = await original<typeof import("@realms-world/value-ledger")>();
  const block = (id: number | string) => {
    const number = id === "latest" ? chain.head : id === "l1_accepted" ? chain.final : (id as number);
    return {
      block_number: number,
      block_hash: `0x${number.toString(16)}`,
      timestamp: 1000 + number,
      status: number <= chain.final ? "ACCEPTED_ON_L1" : "ACCEPTED_ON_L2",
    };
  };
  const ledger = {
    getChainId: async () => (count("getChainId"), "0x1"),
    waitForTransaction: async () => ({ isReverted: () => false }),
    getBlock: async (id: number | string) => (count("getBlock"), block(id)),
    getClassHashAt: async (_address: string, number: number | string) => {
      count("getClassHashAt");
      if (typeof number === "number" && number < 1) throw Object.assign(new Error("not found"), { code: 20 });
      return "0xabc";
    },
    getClassByHash: async () => (count("getClassByHash"), { abi: [] }),
    getEvents: async () => (count("getEvents"), { events: [], continuation_token: undefined }),
    callContract: async ({ entrypoint }: { entrypoint: string }, at?: number | string) => {
      count("callContract");
      if (entrypoint === "balance_of") return ["0", "0"];
      if (entrypoint === "get_preset") return preset();
      if (entrypoint === "get_payment") return payment(true);
      if (entrypoint === "get_frontier") return frontier((typeof at === "number" ? at : chain.head) >= chain.closedAt);
      throw new Error(`unexpected view ${entrypoint}`);
    },
  };
  const shardNode = {
    getChainId: async () => "0x2",
    getBlock: async () => ({ ...block("latest"), status: "ACCEPTED_ON_L2" }),
    getClassHashAt: async () => "0xdef",
    getClassByHash: async () => ({ abi: [] }),
    callContract: async () => ["1"],
  };
  return {
    ...real,
    rpcAt: (url: string) => (url.includes("ledger") ? ledger : shardNode),
    readRegisteredShard: async () => ({
      chainId: "0x2",
      rpcUrl: "https://shard.test",
      url: "https://herald.test",
      contracts: { games: "0x20" },
      releases: releaseLine("0xs", [1]),
    }),
    requireActiveChain: async () => {},
    relayAccountAddress: () => "0x5",
    officialChain: async () => ({ chainId: "0x2" }),
  };
});

// Alchemy's prices (`rpc-cost-1.md`): 20 CU a read, nothing for the chain id.
const PRICE = {
  getBlock: 20,
  getEvents: 20,
  callContract: 20,
  getClassHashAt: 20,
  getClassByHash: 20,
  getChainId: 0,
} as const;
type Counts = Partial<Record<keyof typeof PRICE, number>>;
const compute = (counts: Counts) =>
  (Object.keys(PRICE) as (keyof typeof PRICE)[]).reduce((total, name) => total + (counts[name] ?? 0) * PRICE[name], 0);
const seen = (): Counts => Object.fromEntries([...chain.calls].sort()) as Counts;
/** What `work` read from the ledger, by method, and what that costs. */
async function reads(work: () => Promise<unknown>) {
  chain.calls.clear();
  await work();
  return { counts: seen(), cu: compute(seen()) };
}
const storageOver = (data: Map<string, unknown>) => {
  const storage = {
    get: async <A>(key: string) => data.get(key) as A | undefined,
    put: async (key: string, value: unknown) => void data.set(key, value),
    delete: async (key: string) => data.delete(key),
    list: async ({
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
      const keys = [...data.keys()].filter((key) => key.startsWith(prefix) && (!end || key < end)).sort();
      if (reverse) keys.reverse();
      return new Map(keys.slice(0, limit).map((key) => [key, data.get(key)]));
    },
    setAlarm: async () => {},
    transaction: async (run: (tx: unknown) => Promise<unknown>) => run(storage),
  };
  return storage;
};
const monitor = (data = new Map<string, unknown>()) =>
  new ValueMonitor(
    { storage: storageOver(data) } as unknown as DurableObjectState,
    {
      L2_RPC_URL: "https://ledger.test",
      PAUSER_ACCOUNT_ADDRESS: "0x9",
      ENVIRONMENT: "staging",
      IDENTITY: { l2ChainId: async () => "0x1", shard: async () => null },
      RELAY_REPORT: { held: async () => [] },
    } as never,
  );
const relayEnv = {
  ENVIRONMENT: "staging",
  BASE_URL: "https://play.test",
  L2_RPC_URL: "https://ledger.test",
  OPERATOR_TOKEN: "t",
  LEDGER_OPERATOR_ADDRESS: "0x20",
  LEDGER_OPERATOR_PRIVATE_KEY: "0x30",
  SHARD_LEDGER_OPERATOR_PRIVATE_KEY: "0x1",
  COSIGNER_URL: "https://cosigner.test",
  COSIGNER_TOKEN: "t",
  IDENTITY: { l2ChainId: async () => "0x1", shard: async () => null },
  ROSTER_MONITOR: { ledgerWritten: async () => {} },
};
const relay = (data = new Map<string, unknown>()) =>
  new ValueRelay({ storage: storageOver(data) } as unknown as DurableObjectState, relayEnv as never);

/** The chain moves on between two reads, as it does in an hour. */
const advance = () => {
  chain.head += 100;
  chain.final += 100;
};
beforeEach(() => {
  chain.calls.clear();
  chain.head = 100;
  chain.final = FINAL;
  chain.closedAt = 80;
});

// ---- the hourly audit ----------------------------------------------------------------------------------------------

const AUDIT = { first: 0, steady: 0 };
it("states the monitor's audit: nothing to audit", async () => {
  const quiet = monitor();
  const first = await reads(() => quiet.tick());
  advance();
  const steady = await reads(() => quiet.tick());
  expect(first.counts).toEqual({ callContract: 1, getBlock: 8, getClassHashAt: 10, getEvents: 5 });
  expect(steady.counts).toEqual({ callContract: 1, getBlock: 13, getEvents: 5 });
  AUDIT.first = first.cu;
  AUDIT.steady = steady.cu;
  expect([first.cu, steady.cu]).toEqual([480, 380]);
});

const LEDGER_TICK = { first: 0, steady: 0 };
it("states the relay's ledger tick of a quiet ledger", async () => {
  const worker = relay();
  const first = await reads(() => worker.ledgerTick());
  advance();
  const steady = await reads(() => worker.ledgerTick());
  LEDGER_TICK.first = first.cu;
  LEDGER_TICK.steady = steady.cu;
  expect(first.counts).toEqual({ getBlock: 4, getClassHashAt: 6, getEvents: 3 });
  expect(steady.counts).toEqual({ getBlock: 7, getEvents: 3 });
  expect([first.cu, steady.cu]).toEqual([260, 200]);
});

it("states what one funded game adds to an audit: two views a pool, until the accepted block holds it", async () => {
  const ports = ledgerMonitorReads("https://ledger.test", { contractAddress: "0x10", deploymentBlock: 1 });
  const head = await reads(() => Effect.runPromise(ports.frontierPool("0x1", 7)));
  const final = await reads(() => Effect.runPromise(ports.finalFrontierPool("0x1", 7)));
  expect([head.counts, final.counts]).toEqual([
    { callContract: 1, getBlock: 1 },
    { callContract: 1, getBlock: 1 },
  ]);
  expect(head.cu + final.cu).toBe(80);
});

// ---- payments ------------------------------------------------------------------------------------------------------

const PAYMENT = { read: 0, proofUntilFinal: 0 };
it("states the reads of one payment: its status read, the void check and its proof", async () => {
  const claim = {
    prizeRank: 0,
    prizeCount: 0,
    chainId: "0x2",
    seasonId: 4,
    transactionHash: "0xabc",
    realmsId: "0x2",
    amount: "17",
    confirmedAt: 1000,
  };
  const status = await reads(() => Effect.runPromise(ledgerPaymentRead("https://ledger.test", "0x10")(claim)));
  const proof = await reads(() => Effect.runPromise(ledgerPaymentProof("https://ledger.test", "0x10")(claim)));
  expect(status.counts).toEqual({ callContract: 1 });
  expect(proof.counts).toEqual({ callContract: 2, getBlock: 1 });
  PAYMENT.read = status.cu;
  PAYMENT.proofUntilFinal = proof.cu;
});

// ---- the month -----------------------------------------------------------------------------------------------------

/** Hourly passes strictly after an action at `action` minutes, up to the first at or after acceptance `delay` minutes later. */
const proofPassesFor = (action: number, delay: number) => Math.ceil((action + delay) / 60) - Math.floor(action / 60);
const averageProofPasses = (delay: number) =>
  Array.from({ length: 60 }, (_, minute) => proofPassesFor(minute, delay)).reduce((all, count) => all + count, 0) / 60;
interface Inputs {
  announcedWritesPerDay: number;
  hoursToAcceptance: number;
  payoutsPerDay: number;
  ratingsPlayers: number;
  ratingsRefreshesPerDay: number;
}
const month = (inputs: Inputs) => {
  const days = 30;
  const hourly = 24 * days;
  const writes = inputs.announcedWritesPerDay * days;
  const audits = (hourly + writes) * AUDIT.steady;
  const ticks = (hourly + writes) * LEDGER_TICK.steady;
  const proofPasses = averageProofPasses(inputs.hoursToAcceptance * 60);
  const payments = inputs.payoutsPerDay * days * (PAYMENT.read * 3 + PAYMENT.proofUntilFinal * proofPasses + 800);
  const ratings = inputs.ratingsRefreshesPerDay * days * (inputs.ratingsPlayers + 6) * 20;
  return { audits, ticks, payments, ratings, total: audits + ticks + payments + ratings };
};
it("derives the month for production and dev on one key from the counts above", () => {
  const productionInputs: Inputs = {
    announcedWritesPerDay: 20,
    hoursToAcceptance: 6,
    payoutsPerDay: 40,
    ratingsPlayers: 500,
    ratingsRefreshesPerDay: 26,
  };
  const production = month(productionInputs);
  const dev = month({
    announcedWritesPerDay: 20,
    hoursToAcceptance: 6,
    payoutsPerDay: 10,
    ratingsPlayers: 100,
    ratingsRefreshesPerDay: 26,
  });
  expect(production.audits).toBe((720 + 600) * AUDIT.steady);
  expect(production.total + dev.total).toBeLessThan(30_000_000);
  expect([production.total, dev.total]).toEqual([10_194_000, 2_802_900]);
  expect(production.total + dev.total).toBe(12_996_900);
  // The proof count follows the action's place in the hour and the acceptance time: on the boundary six passes, ten minutes
  // past it seven, and the same for twelve hours.
  expect([0, 10, 59].map((minute) => proofPassesFor(minute, 360))).toEqual([6, 7, 7]);
  expect([0, 10, 59].map((minute) => proofPassesFor(minute, 720))).toEqual([12, 13, 13]);
  const slower = month({ ...productionInputs, hoursToAcceptance: 12 });
  expect(slower.total - production.total).toBe(40 * 30 * 6 * PAYMENT.proofUntilFinal);
  expect(slower.total).toBe(10_626_000);
});
