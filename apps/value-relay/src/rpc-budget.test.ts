/**
 * The read budget at the RPC boundary: every call the ledger's URL receives, counted by method beneath the real readers
 * (the monitor's audit, the relay's ledger tick, the Frontier jobs, the deposit pass, the history route), over a
 * deterministic fake chain. The month's compute units for production and dev follow from these counts and the stated
 * inputs, at the end of the file; adding a read anywhere below changes a number here.
 */
vi.mock("./environment", async (original) => ({
  ...(await original<typeof import("./environment")>()),
  ledgerAddress: () => "0x10",
  ledgerContractOf: () => ({ contractAddress: "0x10", deploymentBlock: 1 }),
}));
import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { response } from "../../../packages/value-ledger/test-support/abi";
import { ledgerAbi } from "../../../packages/value-ledger/test-support/ledger-abi";
import { ValueMonitor } from "./monitor-worker";
import { ValueRelay } from "./worker";
import { ledgerMonitorReads } from "./ledger";
import { memoryFinalFacts } from "./final-facts";
import { publishFrontierPools } from "./frontier-pools";
import { awardFrontierPrizes } from "./frontier-prizes";
import { sweepFrontierLords } from "./frontier-sweep";
import { depositHistory, relayDeposits, type DepositRelayPorts } from "./deposits";

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
vi.mock("./chain", () => ({ ledgerPauserAdapter: () => vi.fn() }));
vi.mock("../../../packages/value-ledger/src/shard-abi", () => ({
  readShardAbi: async () => [{ type: "interface", items: [{ name: "deposit_count" }, { name: "deposit_source" }] }],
}));
const shard = vi.hoisted(() => ({ games: vi.fn(), snapshot: vi.fn() }));
vi.mock("@realms-world/value-ledger/shard", () => ({
  ShardOperator: class {
    admin = vi.fn();
  },
}));
vi.mock("./shard-rpc", async (original) => ({
  ...(await original<typeof import("./shard-rpc")>()),
  ShardReader: class {
    header = async () => ({ timestamp: 100, block_number: 10 });
  },
}));
vi.mock("./frontier-games", () => ({
  readFrontierGames: shard.games,
  frontierTerms: () => ({
    presetId: 6,
    start: 10,
    end: 100,
    seed: "153",
    dayUnit: 5,
    claimWindow: 604800,
    chestPoolBps: 7000,
    topN: 10,
  }),
}));
vi.mock("./shard-snapshot", async (original) => ({
  ...(await original<typeof import("./shard-snapshot")>()),
  readConfirmedSnapshot: shard.snapshot,
}));

const FINAL = 90;
/** Every RPC method the ledger URL receives. */
const rpc = vi.hoisted(() => ({
  calls: new Map<string, number>(),
  head: 100,
  final: 90,
  /** Seasons are closed from this block on. */
  closedAt: 80,
  l1Tag: true,
}));
const count = (name: string) => rpc.calls.set(name, (rpc.calls.get(name) ?? 0) + 1);
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
vi.mock("@realms-world/value-ledger", async (original) => {
  const real = await original<typeof import("@realms-world/value-ledger")>();
  const block = (id: number | string) => {
    if (id === "l1_accepted" && !rpc.l1Tag) throw new Error("unsupported block tag");
    const number = id === "latest" ? rpc.head : id === "l1_accepted" ? rpc.final : (id as number);
    return {
      block_number: number,
      block_hash: `0x${number.toString(16)}`,
      timestamp: 1000 + number,
      status: number <= rpc.final ? "ACCEPTED_ON_L1" : "ACCEPTED_ON_L2",
    };
  };
  return {
    ...real,
    rpcAt: () => ({
      getChainId: async () => (count("getChainId"), "0x1"),
      getBlock: async (id: number | string) => (count("getBlock"), block(id)),
      getClassHashAt: async (_address: string, number: number) => {
        count("getClassHashAt");
        if (number < 1) throw Object.assign(new Error("not found"), { code: 20 });
        return "0xabc";
      },
      getEvents: async () => (count("getEvents"), { events: [], continuation_token: undefined }),
      callContract: async ({ entrypoint }: { entrypoint: string }, at?: number | string) => {
        count("callContract");
        if (entrypoint === "deposit_target_count") return ["0"];
        if (entrypoint === "deposit_principal") return ["0", "0", "0", "0", "0", "0"];
        if (entrypoint === "lords") return ["0x99"];
        if (entrypoint === "balance_of") return ["0", "0"];
        if (entrypoint === "deposit_count") return ["0"];
        if (entrypoint === "get_preset") return preset();
        if (entrypoint === "get_frontier") return frontier((typeof at === "number" ? at : rpc.head) >= rpc.closedAt);
        throw new Error(`unexpected view ${entrypoint}`);
      },
    }),
  };
});

const PRICE = { getBlock: 20, getEvents: 20, callContract: 20, getClassHashAt: 20, getChainId: 0 } as const;
type Counts = Partial<Record<keyof typeof PRICE, number>>;
/** Alchemy's price for these calls: 20 CU each, nothing for the chain id (`rpc-cost-1.md`). */
const compute = (counts: Counts) =>
  (Object.keys(PRICE) as (keyof typeof PRICE)[]).reduce((total, name) => total + (counts[name] ?? 0) * PRICE[name], 0);
const seen = (): Counts => Object.fromEntries([...rpc.calls].sort()) as Counts;
/** What `work` read from the ledger, by method, and what that costs. */
async function reads(work: () => Promise<unknown>) {
  rpc.calls.clear();
  await work();
  return { counts: seen(), cu: compute(seen()) };
}
const storageOver = (data: Map<string, unknown>) => {
  const storage = {
    get: async (key: string) => data.get(key),
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
      LAUNCH: { rosterCohorts: async () => [], directoryGames: async () => [] },
      IDENTITY: { l2ChainId: async () => "0x1", shards: async () => [] },
      RELAY_REPORT: { held: async () => [] },
    } as never,
  );
const relay = (data = new Map<string, unknown>()) =>
  new ValueRelay(
    { storage: storageOver(data) } as unknown as DurableObjectState,
    {
      ENVIRONMENT: "staging",
      L2_RPC_URL: "https://ledger.test",
      LEDGER_OPERATOR_ADDRESS: "0x20",
      LEDGER_OPERATOR_PRIVATE_KEY: "0x30",
      COSIGNER_URL: "https://cosigner.test",
      COSIGNER_TOKEN: "t",
      IDENTITY: { l2ChainId: async () => "0x1", shards: async () => [] },
      ROSTER_MONITOR: { ledgerWritten: async () => {} },
    } as never,
  );

/** The chain moves on between two reads, as it does in an hour. */
const advance = () => {
  rpc.head += 100;
  rpc.final += 100;
};
beforeEach(() => {
  rpc.calls.clear();
  rpc.head = 100;
  rpc.final = FINAL;
  rpc.closedAt = 80;
  rpc.l1Tag = true;
});

// ---- the hourly audit and the ledger tick --------------------------------------------------------------------------

const AUDIT = { first: 660, steady: 560 };
it("states the monitor's audit: the first one probes the deployment, a later one reads each stream once", async () => {
  const worker = monitor();
  const first = await reads(() => worker.tick());
  advance();
  const steady = await reads(() => worker.tick());
  expect(first.counts).toEqual({ callContract: 5, getBlock: 13, getChainId: 1, getClassHashAt: 10, getEvents: 5 });
  expect(steady.counts).toEqual({ callContract: 5, getBlock: 18, getChainId: 1, getEvents: 5 });
  expect([first.cu, steady.cu]).toEqual([AUDIT.first, AUDIT.steady]);
});

const LEDGER_TICK = { first: 260, steady: 200 };
it("states the relay's ledger tick of a quiet ledger", async () => {
  const worker = relay();
  const first = await reads(() => worker.ledgerTick());
  advance();
  const steady = await reads(() => worker.ledgerTick());
  expect(first.counts).toEqual({ getBlock: 4, getClassHashAt: 6, getEvents: 3 });
  expect(steady.counts).toEqual({ getBlock: 7, getEvents: 3 });
  expect([first.cu, steady.cu]).toEqual([LEDGER_TICK.first, LEDGER_TICK.steady]);
});

const POOL_UNTIL_FINAL = 80;
it("states what one funded game adds to an audit: two views a pool, until the accepted block holds it", async () => {
  const ports = ledgerMonitorReads("https://ledger.test", { contractAddress: "0x10", deploymentBlock: 1 });
  const head = await reads(() => Effect.runPromise(ports.frontierPool("0x1", 7)));
  const final = await reads(() => Effect.runPromise(ports.finalFrontierPool("0x1", 7)));
  expect([head.counts, final.counts]).toEqual([
    { callContract: 1, getBlock: 1 },
    { callContract: 1, getBlock: 1 },
  ]);
  expect(head.cu + final.cu).toBe(POOL_UNTIL_FINAL / 1);
});

// ---- the relay's minute tick ---------------------------------------------------------------------------------------

const ledgerForJobs = () => ({ rpcUrl: "https://ledger.test", address: "0x30", finals: memoryFinalFacts() });
const target = {
  chainId: "0x1",
  rpcUrl: "https://shard.test",
  gamesAddress: "0x10",
  firstRelease: 1,
  accountAddress: "0x20",
  privateKey: "0x1",
};
/** N ended Frontier games, each with three returned principals and an unissued prize. */
function endedGames(games: number) {
  shard.games.mockResolvedValue({
    confirmedBlock: 10,
    games: Array.from({ length: games }, (_, index) => ({ game_id: index + 1, clock: { end_at: 100 } })),
  });
  shard.snapshot.mockImplementation(async (_t: unknown, _h: string, gameId: number) => ({
    confirmed_block: 10,
    game_id: String(gameId),
    models: [
      { model: "LordsBudget", rows: [{ key: "b", value: { game_id: gameId, pool: "700", pool_left: "700" } }] },
      { model: "FrontierPrize", rows: [{ key: "p", value: { game_id: gameId, pool: "0", issued: "0", count: null } }] },
      { model: "ResourceBalance", rows: [] },
      { model: "LordsWithdrawal", rows: [] },
      { model: "SpendLords", rows: [] },
      {
        model: "PrincipalWithdrawal",
        rows: [8, 9, 10].map((account) => ({
          key: String(account),
          value: { game_id: gameId, account: `0x${account}`, amount: "40" },
        })),
      },
    ],
  }));
}
/** One minute of the relay's Frontier jobs: pools, prizes, sweep and principal returns. */
const minute = (ledger: ReturnType<typeof ledgerForJobs>, paid: "final" | "head") => async () => {
  await publishFrontierPools(target, "https://herald.test", ledger);
  await awardFrontierPrizes(target, "https://herald.test", ledger);
  await sweepFrontierLords(
    target,
    "https://herald.test",
    ledger,
    async () => {},
    async () => (paid === "final" ? { block: FINAL, hash: `0x${FINAL.toString(16)}` } : null),
  );
};

it.each([1, 5, 20])("states a relay minute over %i ended games: promotion reads once, then none", async (games) => {
  endedGames(games);
  const ledger = ledgerForJobs();
  const first = await reads(minute(ledger, "final"));
  // Per game, the prize job reads the funding (season and preset) at the head and at the accepted block, and the
  // accepted block's header once; the season is then kept closed and the sweep has nothing to ask.
  expect(first.counts).toEqual({ callContract: 4 * games, getBlock: games + games });
  expect((await reads(minute(ledger, "final"))).counts).toEqual({});
  expect((await reads(minute(ledger, "final"))).counts).toEqual({});
});

const WAITING_MINUTE = { callContract: 4, getBlock: 2 };
it("states a relay minute while the accepted block does not hold the closing yet", async () => {
  endedGames(1);
  rpc.closedAt = 95;
  const ledger = ledgerForJobs();
  const each = await reads(minute(ledger, "final"));
  expect((await reads(minute(ledger, "final"))).counts).toEqual(each.counts);
  expect(each.counts).toEqual(WAITING_MINUTE);
  expect(each.cu).toBe(120);
});

it("states a relay minute where the node does not answer the accepted-block tag", async () => {
  endedGames(1);
  rpc.l1Tag = false;
  const ledger = ledgerForJobs();
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  const each = await reads(minute(ledger, "head"));
  expect((await reads(minute(ledger, "head"))).counts).toEqual(each.counts);
  logged.mockRestore();
  expect(each.cu).toBeGreaterThan(0);
});

// ---- deposits and the history route --------------------------------------------------------------------------------

const depositPorts = (data: Map<string, unknown>): DepositRelayPorts => ({
  target,
  heraldUrl: "https://herald.test",
  ledger: { rpcUrl: "https://ledger.test", address: "0x10", chainId: "0x1" },
  storage: storageOver(data) as never,
  sign: async () => ({ r: "0x1", s: "0x2" }),
  mutate: async () => {},
});
const DEPOSIT_PASS = 200;
it("states a deposit pass with nothing new, which is what the hour costs, and the history route's reads: none", async () => {
  const data = new Map<string, unknown>();
  const ports = depositPorts(data);
  await relayDeposits(ports);
  const quiet = await reads(() => relayDeposits(ports));
  expect(quiet.cu).toBe(DEPOSIT_PASS);
  // The page asks every two seconds while the purse is open; the relay answers from what it keeps.
  const history = await reads(async () => {
    for (let ask = 0; ask < 1800; ask++) await depositHistory(ports, "0x77");
  });
  expect(history.counts).toEqual({});
});

// ---- the month -----------------------------------------------------------------------------------------------------

/**
 * One environment's month in compute units, from the numbers stated above and explicit inputs. Every term is a count of
 * RPC calls times 20 CU; nothing here is a measurement of production, it is what the code does for these inputs.
 */
const month = (inputs: {
  announcedWritesPerDay: number;
  endedGamesWaitingForAcceptance: number;
  hoursToAcceptance: number;
  ratingsRefreshesPerDay: number;
  ratingsPlayers: number;
  depositPassesPerDay: number;
}) => {
  const days = 30;
  const hourly = 24 * days;
  const writes = inputs.announcedWritesPerDay * days;
  const audits = (hourly + writes) * AUDIT.steady;
  const ticks = (hourly + writes) * LEDGER_TICK.steady;
  const waiting = inputs.endedGamesWaitingForAcceptance * inputs.hoursToAcceptance * 60 * 120;
  const deposits = inputs.depositPassesPerDay * days * DEPOSIT_PASS;
  // A board refresh reads one rating per rated player and six more (`rating-reader.test.ts` states it by method).
  const ratings = inputs.ratingsRefreshesPerDay * days * (inputs.ratingsPlayers + 6) * 20;
  return { audits, ticks, waiting, deposits, ratings, total: audits + ticks + waiting + deposits + ratings };
};
it("derives the month for production and dev on one key from the counts above", () => {
  // Inputs: production has one ended game and about 500 rated players; dev has four ended games and 100; both see 20
  // announced writes a day, a deposit pass an hour, a ratings refresh an hour and one per results post (two a day),
  // and Ethereum takes six hours to accept a block (an assumption, not a measurement).
  const production = month({
    announcedWritesPerDay: 20,
    endedGamesWaitingForAcceptance: 1,
    hoursToAcceptance: 6,
    ratingsRefreshesPerDay: 26,
    ratingsPlayers: 500,
    depositPassesPerDay: 24,
  });
  const dev = month({
    announcedWritesPerDay: 20,
    endedGamesWaitingForAcceptance: 4,
    hoursToAcceptance: 6,
    ratingsRefreshesPerDay: 26,
    ratingsPlayers: 100,
    depositPassesPerDay: 24,
  });
  expect(production.audits).toBe((720 + 600) * 560);
  expect(production.ticks).toBe((720 + 600) * 200);
  expect(production.waiting).toBe(43_200);
  expect(production.deposits).toBe(144_000);
  expect(production.ratings).toBe(7_893_600);
  expect([production.total, dev.total]).toEqual([9_084_000, 2_973_600]);
  expect(production.total + dev.total).toBe(12_057_600);
  expect(production.total + dev.total).toBeLessThan(30_000_000);
});
