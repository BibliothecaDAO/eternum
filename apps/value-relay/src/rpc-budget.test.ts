/**
 * The read budget at the RPC boundary. Every paid reader below is the real one (the monitor's audit with its custody
 * audit and shard ABI reads, the relay's ledger tick, the Frontier jobs, the deposit pass, the payment proof, the public
 * history route through the Worker's own `fetch`); only the transport is fake, a deterministic chain that counts every
 * call the ledger's URL receives, by method. The month for production and dev follows from those counts and the stated
 * inputs at the end of the file: adding a read anywhere in a reader changes a number here.
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
import { realmsAccountAddress } from "../../../packages/identity/src/account";
import worker, { ValueRelay } from "./worker";
import { ValueMonitor } from "./monitor-worker";
import { ledgerMonitorReads } from "./ledger";
import { ledgerPaymentProof, ledgerPaymentRead } from "./chain";
import { durableFinalFacts, memoryFinalFacts } from "./final-facts";
import { memoryObligations } from "./obligations";
import { publishFrontierPools } from "./frontier-pools";
import { awardFrontierPrizes } from "./frontier-prizes";
import { sweepFrontierLords } from "./frontier-sweep";
import { relayDeposits, type DepositRelayPorts } from "./deposits";
import type { LordsDeposit } from "@realms-world/value-ledger/deposits";

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
const shard = vi.hoisted(() => ({
  games: vi.fn(),
  snapshot: vi.fn(),
  /** What the shard holds for each (game, id) it credited: the commitment it was told. */
  receipts: new Map<string, { commitment: string; account: string }>(),
}));
vi.mock("@realms-world/value-ledger/shard", async () => {
  const { depositCommitment } = await import("@realms-world/value-ledger/deposits");
  return {
    ShardOperator: class {
      provider = {
        callContract: async ({ calldata }: { calldata: string[] }) => {
          const held = shard.receipts.get(`${BigInt(calldata[0]!)}:${BigInt(calldata[1]!)}`);
          return held ? ["0", held.commitment, held.account, "40", "0"] : ["1"];
        },
      };
      admin = async (
        _method: string,
        args: {
          game_id: number;
          deposit: {
            id: string;
            account: string;
            realms_id: string;
            home: string;
            payer: string;
            amount: string;
            paid_at: string;
          };
        },
      ) => {
        const deposit = args.deposit;
        shard.receipts.set(`${args.game_id}:${BigInt(deposit.id)}`, {
          account: deposit.account,
          commitment: depositCommitment(
            { chainId: "0x1", ledger: "0x10" },
            {
              shard: "0x2",
              id: deposit.id,
              gameId: args.game_id,
              games: "0x20",
              account: deposit.account,
              realmsId: deposit.realms_id,
              home: deposit.home,
              payer: deposit.payer,
              amount: deposit.amount,
              paidAt: deposit.paid_at,
              status: "pending",
            },
          ),
        });
        return { transactionHash: "0x1", events: [] };
      };
    },
  };
});
vi.mock("starknet", async (original) => ({
  ...(await original<typeof import("starknet")>()),
  Account: class {
    execute = async ({ entrypoint, calldata }: { entrypoint: string; calldata: string[] }) => {
      if (entrypoint !== "resolve_deposit") throw new Error(`unexpected write ${entrypoint}`);
      chain.writes++;
      chain.resolved.add(Number(BigInt(calldata[1]!)));
      return { transaction_hash: "0x11" };
    };
  },
}));
vi.mock("./deposit-destination", async (original) => ({
  ...(await original<typeof import("./deposit-destination")>()),
  readDepositEvidence: async () => ({ remember: async () => {} }),
  depositDestinationError: async () => null,
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

// ---- the fake transport --------------------------------------------------------------------------------------------

const FINAL = 90;
const ACCOUNT = realmsAccountAddress("0x77", "0x11", "0x22");
/** The ledger the transport answers for: its blocks, its custody targets and deposits, which payments it holds. */
const chain = vi.hoisted(() => ({
  calls: new Map<string, number>(),
  head: 100,
  final: 90,
  /** Seasons are closed from this block on. */
  closedAt: 80,
  l1Tag: true,
  targets: 0,
  deposits: 0,
  /** Whether the accepted block already holds the deposits' resolution. */
  depositsFinal: true,
  /** Deposits that are pending on the ledger until a resolution is sent, and the ones resolved since. */
  unresolved: new Set<number>(),
  resolved: new Set<number>(),
  /** Resolutions sent (a modeled cost, not a count at the transport). */
  writes: 0,
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
const depositFields = (id: number, status = "1") => [
  "1",
  "0x20",
  String(BigInt(ACCOUNT) + BigInt(id)),
  "0x77",
  "17",
  "0x33",
  "40",
  "999",
  status,
];
const abi = [{ type: "interface", items: [{ name: "deposit_count" }, { name: "deposit_source" }] }];
vi.mock("@realms-world/value-ledger", async (original) => {
  const real = await original<typeof import("@realms-world/value-ledger")>();
  const block = (id: number | string) => {
    if (id === "l1_accepted" && !chain.l1Tag) throw new Error("unsupported block tag");
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
    getClassByHash: async () => (count("getClassByHash"), { abi }),
    getEvents: async () => (count("getEvents"), { events: [], continuation_token: undefined }),
    callContract: async (
      { entrypoint, calldata }: { entrypoint: string; calldata: string[] },
      at?: number | string,
    ) => {
      count("callContract");
      const received = BigInt(chain.deposits) * 40n * 10n ** 18n;
      if (entrypoint === "deposit_target_count") return [String(chain.targets)];
      if (entrypoint === "deposit_target_at") return ["0x2", String(Number(calldata[0]) + 1)];
      if (entrypoint === "deposit_target") return ["0x20"];
      if (entrypoint === "deposit_count") return [String(chain.deposits)];
      if (entrypoint === "get_deposit")
        return depositFields(
          Number(calldata[1]),
          chain.unresolved.has(Number(calldata[1])) && !chain.resolved.has(Number(calldata[1]))
            ? "0"
            : typeof at === "number" && !chain.depositsFinal
              ? "0"
              : "1",
        );
      if (entrypoint === "principal_payment") return ["1"];
      if (entrypoint === "deposit_principal")
        return [String(received % 2n ** 128n), String(received >> 128n), "0", "0", "0", "0"];
      if (entrypoint === "lords") return ["0x99"];
      if (entrypoint === "balance_of") return [String(received % 2n ** 128n), String(received >> 128n)];
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
    getClassByHash: async () => ({ abi }),
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
      releaseSchemas: { "1": "0xs" },
    }),
    requireActiveChain: async () => {},
    relayAccountAddress: () => "0x5",
    activeShards: async () => [{ chainId: "0x2" }],
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
      LAUNCH: { rosterCohorts: async () => [], directoryGames: async () => [] },
      IDENTITY: { l2ChainId: async () => "0x1", shards: async () => [] },
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
  IDENTITY: {
    l2ChainId: async () => "0x1",
    shards: async () => [],
    authenticate: async () => ({ realmsId: "0x77" }),
  },
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
  chain.l1Tag = true;
  chain.targets = 0;
  chain.deposits = 0;
  chain.depositsFinal = true;
  chain.unresolved = new Set();
  chain.resolved = new Set();
  chain.writes = 0;
  shard.receipts = new Map();
});

// ---- the hourly audit ----------------------------------------------------------------------------------------------

const AUDIT = { first: 0, steady: 0 };
it("states the monitor's audit with its custody audit and shard ABI reads: nothing to audit", async () => {
  const quiet = monitor();
  const first = await reads(() => quiet.tick());
  advance();
  const steady = await reads(() => quiet.tick());
  expect(first.counts).toMatchObject({
    callContract: 5,
    getBlock: 14,
    getChainId: 1,
    getClassHashAt: 11,
    getEvents: 5,
  });
  expect(steady.counts).toEqual({ callContract: 5, getBlock: 19, getChainId: 1, getClassHashAt: 1, getEvents: 5 });
  AUDIT.first = first.cu;
  AUDIT.steady = steady.cu;
  expect([first.cu, steady.cu]).toEqual([720, 600]);
});

/** What each custody target and each deposit adds to an audit: the deposits are final after the first audit. */
const CUSTODY = { perTarget: 0, perShard: 0, perUnpaidPrincipal: 0 };
it("states what custody targets and deposits add to an audit, with every deposit delivered", async () => {
  const empty = monitor();
  await empty.tick();
  advance();
  const base = (await reads(() => empty.tick())).counts;
  chain.targets = 2;
  chain.deposits = 30;
  const worker = monitor();
  const first = await reads(() => worker.tick());
  advance();
  const steady = await reads(() => worker.tick());
  // First audit: each deposit at the head and at the accepted block, each unpaid principal at the head. Later audits: the
  // deposits are kept as final; the unpaid principals are read again, one per depositor.
  const extra = (counts: Counts) => compute(counts) - compute(base);
  // Two targets cost two views each and the one shard's count one: five reads, and thirty unpaid principals thirty.
  expect(first.counts.callContract! - base.callContract!).toBe(5 + 30 * 3);
  expect(steady.counts.callContract! - base.callContract!).toBe(5 + 30);
  CUSTODY.perTarget = 2 * 20;
  CUSTODY.perShard = 20;
  CUSTODY.perUnpaidPrincipal = 20;
  expect([extra(first.counts), extra(steady.counts)]).toEqual([2000, 680]);
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

// ---- the relay's minute tick: Frontier jobs ------------------------------------------------------------------------

const ledgerForJobs = () => ({
  rpcUrl: "https://ledger.test",
  address: "0x30",
  finals: memoryFinalFacts(),
  obligations: memoryObligations(),
  proofs: false,
});
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
/** One minute of the relay's Frontier jobs; each principal's attempt answers as the ledger actor does. */
const minute = (ledger: ReturnType<typeof ledgerForJobs>, principals: "final" | "head") => async () => {
  await publishFrontierPools(target, "https://herald.test", ledger);
  await awardFrontierPrizes(target, "https://herald.test", ledger);
  await sweepFrontierLords(
    target,
    "https://herald.test",
    ledger,
    async () => {},
    async () => (principals === "final" ? { block: FINAL, hash: `0x${FINAL.toString(16)}` } : null),
  );
};

it.each([1, 5, 20])("states a relay minute over %i ended games: promotion reads once, then none", async (games) => {
  endedGames(games);
  const ledger = ledgerForJobs();
  const first = await reads(minute(ledger, "final"));
  expect(first.counts).toEqual({ callContract: 4 * games, getBlock: 2 * games });
  expect((await reads(minute(ledger, "final"))).counts).toEqual({});
  expect((await reads(minute(ledger, "final"))).counts).toEqual({});
});

const WAITING_MINUTE = 120;
it("states a relay minute while the accepted block does not hold the closing yet", async () => {
  endedGames(1);
  chain.closedAt = 95;
  const ledger = ledgerForJobs();
  const each = await reads(minute(ledger, "final"));
  expect((await reads(minute(ledger, "final"))).counts).toEqual(each.counts);
  expect(each.counts).toEqual({ callContract: 4, getBlock: 2 });
  expect(each.cu).toBe(WAITING_MINUTE);
});

const UNSUPPORTED_MINUTE = 80;
it("states a relay minute where the node does not answer the accepted-block tag", async () => {
  endedGames(1);
  chain.l1Tag = false;
  const ledger = ledgerForJobs();
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  const each = await reads(minute(ledger, "head"));
  expect((await reads(minute(ledger, "head"))).counts).toEqual(each.counts);
  logged.mockRestore();
  // Nothing is kept, so every minute reads the season again at the head: the old per-minute cost.
  expect(each.counts).toEqual({ callContract: 2, getBlock: 2 });
  expect(each.cu).toBe(UNSUPPORTED_MINUTE);
});

// ---- the deposit pass: discovery, obligations awaiting proof, retries and a restart ---------------------------------

const depositPorts = (data: Map<string, unknown>, proofs: boolean): DepositRelayPorts => ({
  target: { ...target, chainId: "0x2", gamesAddress: "0x20" },
  heraldUrl: "https://herald.test",
  ledger: { rpcUrl: "https://ledger.test", address: "0x10", chainId: "0x1" },
  storage: storageOver(data) as never,
  finals: durableFinalFacts(storageOver(data)),
  obligations: storageOver(data),
  proofs,
  sign: async () => ({ r: "0x1", s: "0x2" }),
  mutate: async () => {},
});
const DEPOSIT = { quiet: 0, perObligationAwaiting: 0, discoveryEach: 0, proofSingle: 0 };
const DEPOSIT_QUIET = 180;
it("states a deposit pass with nothing new, with obligations awaiting proof, and after a restart", async () => {
  const data = new Map<string, unknown>();
  await relayDeposits(depositPorts(data, false));
  const quiet = await reads(() => relayDeposits(depositPorts(data, false)));
  expect(quiet.cu).toBe(DEPOSIT_QUIET);
  DEPOSIT.quiet = quiet.cu;
  // Ten deposits are discovered and resolved; the accepted block does not hold the resolutions yet, so they await proof.
  chain.deposits = 10;
  chain.depositsFinal = false;
  const discovery = await reads(() => relayDeposits(depositPorts(data, false)));
  DEPOSIT.discoveryEach = (discovery.cu - quiet.cu) / 10;
  // A plain pass leaves them alone: it reads what a quiet pass reads.
  expect((await reads(() => relayDeposits(depositPorts(data, false)))).counts).toEqual(quiet.counts);
  // The hour's proof pass attempts each once; after a restart (a new pass over the same storage) the same again.
  const proof = await reads(() => relayDeposits(depositPorts(data, true)));
  const restarted = await reads(() => relayDeposits(depositPorts(data, true)));
  expect(restarted.counts).toEqual(proof.counts);
  DEPOSIT.perObligationAwaiting = (proof.cu - quiet.cu) / 10;
  // Per deposit: the head view, the accepted view and their blocks; the accepted head is shared by the ten.
  expect(DEPOSIT.perObligationAwaiting).toBe(62);
  // One deposit alone: the accepted head is read for it alone, so this is the price per deposit when they arrive one by one.
  const single = new Map<string, unknown>();
  chain.deposits = 1;
  await relayDeposits(depositPorts(single, false));
  const alone = await reads(() => relayDeposits(depositPorts(single, true)));
  DEPOSIT.proofSingle = alone.cu - quiet.cu;
  expect(DEPOSIT.proofSingle).toBe(80);
  chain.deposits = 10;
  // Once the accepted block holds them, one proof pass settles all ten and later ones are quiet again.
  chain.depositsFinal = true;
  await relayDeposits(depositPorts(data, true));
  expect((await reads(() => relayDeposits(depositPorts(data, true)))).counts).toEqual(quiet.counts);
});

// ---- the public history route, through the Worker's own fetch --------------------------------------------------------

it("serves a populated deposit history through the public route with no read, however often the page asks", async () => {
  const data = new Map<string, unknown>();
  const deposits = 60;
  for (let id = 1; id <= deposits; id++) {
    const row: LordsDeposit = {
      shard: "0x2",
      id: String(id),
      gameId: 1,
      games: "0x20",
      account: ACCOUNT,
      realmsId: id % 2 ? "0x77" : "0x88",
      home: "17",
      payer: "0x33",
      amount: "40",
      paidAt: "999",
      status: "delivered",
    };
    data.set(`deposit-row:2:${String(id).padStart(20, "0")}`, row);
  }
  const instance = relay(data);
  const env = {
    ...relayEnv,
    RELAY: { idFromName: (id: string) => id, get: () => instance },
  };
  const ask = () =>
    worker.fetch(
      new Request("https://play.test/api/value/deposits?chainId=0x2", { headers: { cookie: "s=1" } }),
      env as never,
    );
  await instance.deposits("0x2", "0x77");
  const first = await ask();
  expect(first.status).toBe(200);
  const page = (await first.json()) as { rows: { id: string }[]; next: string | null };
  expect(page.rows.length).toBe(25);
  expect(page.next).toBe("10");
  const history = await reads(async () => {
    for (let asks = 0; asks < 1800; asks++) await ask();
  });
  expect(history.counts).toEqual({});
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

// ---- the public delivery action: a real POST, its resolution, a retry, a recovery and a restart -------------------------

/** The modeled price of a ledger write: fee estimate, nonce, the transaction and one receipt poll (`rpc-cost-3.md`). */
const WRITE = 20 + 20 + 160 + 20;
const DELIVERY = { failure: 0, success: 0, again: 0, recovery: 0, restart: 0 };
it("counts a deposit delivered through the public route: success, a repeat, a failure and its retry, a recovery, a restart", async () => {
  let cosigner = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => (cosigner ? Response.json({ r: "0x1", s: "0x2" }) : new Response(null, { status: 503 }))),
  );
  chain.deposits = 1;
  chain.unresolved = new Set([1]);
  chain.depositsFinal = false;
  const data = new Map<string, unknown>();
  const instance = relay(data);
  const namespace = (actor: () => ValueRelay) => ({ idFromName: (id: string) => id, get: () => actor() });
  // The relay is its own ledger actor here: the route and the delivery's mutation reach the same worker, as they do in one DO.
  Object.assign((instance as unknown as { env: object }).env, { RELAY: namespace(() => instance) });
  const env = { ...relayEnv, RELAY: namespace(() => instance) };
  const post = () =>
    worker.fetch(
      new Request("https://play.test/api/value/deposits/deliver?chainId=0x2", {
        method: "POST",
        headers: { origin: "https://play.test", cookie: "s=1" },
      }),
      env as never,
    );
  // The co-signer is down: the pass fails after reading, sends nothing, and the report stays for the retry.
  const failure = await reads(async () => {
    const response = await post();
    expect(((await response.json()) as { error: unknown[] }).error).toHaveLength(1);
  });
  expect(chain.writes).toBe(0);
  DELIVERY.failure = failure.cu;
  cosigner = true;
  const success = await reads(async () => {
    const response = await post();
    expect(response.status).toBe(200);
  });
  expect(chain.writes).toBe(1);
  expect([...chain.resolved]).toEqual([1]);
  DELIVERY.success = success.cu;
  // The report is shared and the work is settled for now: a repeat reads what a quiet pass reads, nothing delivered again.
  const again = await reads(async () => expect((await post()).status).toBe(200));
  expect(chain.writes).toBe(1);
  DELIVERY.again = again.cu;
  // The ledger replaces the block that held the resolution; the hourly proof pass redoes it and costs a write again.
  chain.resolved = new Set();
  const recovery = await reads(async () => {
    await relayDeposits({ ...depositPorts(data, true), mutate: (request) => instance.depositMutation(request) });
  });
  expect(chain.writes).toBe(2);
  DELIVERY.recovery = recovery.cu;
  // A restart is a new worker over the same storage: the same pass reads the same.
  const restarted = relay(data);
  Object.assign((restarted as unknown as { env: object }).env, { RELAY: namespace(() => restarted) });
  chain.resolved = new Set();
  const restart = await reads(async () => {
    await relayDeposits({ ...depositPorts(data, true), mutate: (request) => restarted.depositMutation(request) });
  });
  expect(restart.counts).toEqual(recovery.counts);
  expect(chain.writes).toBe(3);
  DELIVERY.restart = restart.cu;
  // Reads only; each resolution is one modeled write (WRITE), counted separately as `chain.writes`.
  expect(DELIVERY).toEqual({ failure: 160, success: 460, again: 180, recovery: 520, restart: 520 });
  vi.unstubAllGlobals();
});

// ---- the month -----------------------------------------------------------------------------------------------------

/** Hourly passes strictly after an action at `action` minutes, up to the first at or after acceptance `delay` minutes later. */
const proofPassesFor = (action: number, delay: number) => Math.ceil((action + delay) / 60) - Math.floor(action / 60);
const averageProofPasses = (delay: number) =>
  Array.from({ length: 60 }, (_, minute) => proofPassesFor(minute, delay)).reduce((all, count) => all + count, 0) / 60;
interface Inputs {
  announcedWritesPerDay: number;
  endedGamesWaiting: number;
  hoursToAcceptance: number;
  targets: number;
  depositors: number;
  newDepositsPerDay: number;
  payoutsPerDay: number;
  ratingsPlayers: number;
  ratingsRefreshesPerDay: number;
  depositPassesPerDay: number;
}
const completedDeliveryReads = () => {
  if (DELIVERY.success === 0) throw new Error("the delivery action was not measured before the month");
  return DELIVERY.success;
};
/**
 * One environment's month in compute units: every term is a count measured above times 20 CU. The payment writes (a
 * report, a payment, their fee estimates and receipt polls) are not counted by a fake here; they are priced from
 * Alchemy's table at 800 CU a payment (`rpc-cost-3.md`).
 */
const month = (inputs: Inputs, deliveryReads = completedDeliveryReads()) => {
  const days = 30;
  const hourly = 24 * days;
  const writes = inputs.announcedWritesPerDay * days;
  const audits = (hourly + writes) * AUDIT.steady;
  const custody =
    (hourly + writes) *
    (inputs.targets * CUSTODY.perTarget + CUSTODY.perShard + inputs.depositors * CUSTODY.perUnpaidPrincipal);
  const ticks = (hourly + writes) * LEDGER_TICK.steady;
  const waiting = inputs.endedGamesWaiting * inputs.hoursToAcceptance * 60 * WAITING_MINUTE;
  // An obligation is proven by the hourly passes after its action until the first at or after Ethereum's acceptance. That
  // count depends on where in the hour the action falls, so it is averaged over every minute of the hour.
  const proofPasses = averageProofPasses(inputs.hoursToAcceptance * 60);
  const deposits =
    inputs.depositPassesPerDay * days * DEPOSIT.quiet +
    inputs.newDepositsPerDay * days * (deliveryReads + WRITE + proofPasses * DEPOSIT.proofSingle);
  const payments = inputs.payoutsPerDay * days * (PAYMENT.read * 3 + PAYMENT.proofUntilFinal * proofPasses + 800);
  const ratings = inputs.ratingsRefreshesPerDay * days * (inputs.ratingsPlayers + 6) * 20;
  return {
    audits,
    custody,
    ticks,
    waiting,
    deposits,
    payments,
    ratings,
    total: audits + custody + ticks + waiting + deposits + payments + ratings,
  };
};
it("derives the month for production and dev on one key from the counts above", () => {
  // Inputs, stated: production has one ended game, 2 custody targets, 100 depositors, 5 new deposits and 40 payouts a day
  // and 500 rated players; dev four ended games, 4 targets, 30 depositors, 5 new deposits and 10 payouts a day and 100
  // rated players. Both see 20 announced relay writes a day (each causing one audit and one ledger tick), a deposit
  // pass an hour, a ratings refresh an hour and one per result post (26 a day), and Ethereum takes six hours to accept
  // a block (an assumption, not a measurement).
  const productionInputs: Inputs = {
    announcedWritesPerDay: 20,
    endedGamesWaiting: 1,
    hoursToAcceptance: 6,
    targets: 2,
    depositors: 100,
    newDepositsPerDay: 5,
    payoutsPerDay: 40,
    ratingsPlayers: 500,
    ratingsRefreshesPerDay: 26,
    depositPassesPerDay: 24,
  };
  const production = month(productionInputs);
  const dev = month({
    announcedWritesPerDay: 20,
    endedGamesWaiting: 4,
    hoursToAcceptance: 6,
    targets: 4,
    depositors: 30,
    newDepositsPerDay: 5,
    payoutsPerDay: 10,
    ratingsPlayers: 100,
    ratingsRefreshesPerDay: 26,
    depositPassesPerDay: 24,
  });
  expect(production.audits).toBe((720 + 600) * AUDIT.steady);
  expect(production.total + dev.total).toBeLessThan(30_000_000);
  expect([production.total, dev.total]).toEqual([13_615_000, 4_611_100]);
  expect(production.total + dev.total).toBe(18_226_100);
  // The proof count follows the action's place in the hour and the acceptance time: on the boundary six passes, ten minutes
  // past it seven, and the same for twelve hours.
  expect([0, 10, 59].map((minute) => proofPassesFor(minute, 360))).toEqual([6, 7, 7]);
  expect([0, 10, 59].map((minute) => proofPassesFor(minute, 720))).toEqual([12, 13, 13]);
  // The finality assumption drives the proof reads: twice the acceptance delay costs six more hours of proof passes for
  // every new deposit and payment, and six more hours of waiting for each unclosed game.
  const slower = month({ ...productionInputs, hoursToAcceptance: 12 });
  expect(slower.total - production.total).toBe(
    43_200 + 5 * 30 * 6 * DEPOSIT.proofSingle + 40 * 30 * 6 * PAYMENT.proofUntilFinal,
  );
  expect(slower.total).toBe(14_162_200);
  // The delivery action's measured reads are in the month: each of the 150 new deposits a month pays for them.
  expect(month(productionInputs, DELIVERY.success + 20).total - production.total).toBe(5 * 30 * 20);
});
