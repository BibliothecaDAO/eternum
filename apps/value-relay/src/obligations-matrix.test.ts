/**
 * The invariant: anything the relay owes the chain or a player (a deposit to deliver or refund, a principal to return, a
 * withdrawal to pay) is durable work from the moment it is known until the accepted chain proves its outcome.
 *
 * This is the matrix that closes the class. One world carries every kind of obligation at once. For every scenario of
 * chain events (nothing, a block replaced, a deposit that vanishes with its block, the accepted block unreadable, a lost
 * reply) and for every durable write of every pass of the schedule (discovery, attempt, recovery, proof, cleanup, final
 * settlement), the worker is killed there and a new worker over the same storage carries on. At the end each obligation
 * has exactly one canonical outcome, the queues are empty, the history says what the chain says, and the work that was
 * unrelated to the failure (a later deposit, the withdrawal, the principal) completed. A deposit that vanished after the
 * shard had credited it is the one outcome that must instead be a loud custody fault; it must not stop the rest.
 */
vi.mock("./deposit-destination", () => ({
  supportsDeposits: async () => true,
  readDepositEvidence: async () => ({ remember: async () => {} }),
  depositDestinationError: async (_evidence: unknown, payment: { payer: string }) =>
    payment.payer === "0x44" ? "bad" : null,
  depositStructures: () => [],
}));
import { beforeEach, expect, it, vi } from "vitest";
import { Effect } from "effect";
import { depositCommitment } from "@realms-world/value-ledger/deposits";
import { response } from "../../../packages/value-ledger/test-support/abi";
import { ledgerAbi } from "../../../packages/value-ledger/test-support/ledger-abi";
import { realmsAccountAddress } from "../../../packages/identity/src/account";
import { depositHistory, depositsSettled, relayDeposits, type DepositRelayPorts } from "./deposits";
import { mutateDeposit } from "./deposit-ledger";
import { ledgerPaymentProof, ledgerPaymentRead } from "./chain";
import { durableFinalFacts } from "./final-facts";
import { sweepFrontierLords } from "./frontier-sweep";
import { runRelay } from "./relay";
import { DurableRelayStore } from "./state";
import { RelayFailure, type ConfirmedBlock, type RelayPorts, type Withdrawal } from "./ports";

const ACCOUNT = realmsAccountAddress("0x77", "0x11", "0x22");
/** A ledger whose unaccepted blocks can be replaced; every transaction lives in the block that carried it. */
const world = vi.hoisted(() => {
  const state = {
    blocks: [] as { hash: string; txs: string[] }[],
    accepted: 9,
    salt: 0,
    shardReceipts: new Map<string, { cancelled: boolean; payer: string; paidAt: string }>(),
    sent: [] as string[],
    finalityDown: false,
    shardDown: false,
    loseReply: new Set<string>(),
    /** Transactions whose first send fails before reaching the chain. */
    failBefore: new Set<string>(),
    lost: false,
  };
  const reset = () => {
    state.salt = 0;
    state.accepted = 9;
    state.shardReceipts = new Map();
    state.sent = [];
    state.finalityDown = false;
    state.shardDown = false;
    state.loseReply = new Set();
    state.failBefore = new Set();
    state.lost = false;
    state.blocks = Array.from({ length: 11 }, (_, number) => ({ hash: `0x${number.toString(16)}a0`, txs: [] }));
    state.blocks[5]!.txs.push("deposit:A");
    state.blocks[6]!.txs.push("deposit:B");
  };
  reset();
  const head = () => state.blocks.length - 1;
  const numberOf = (id: number | string) => {
    if (id === "latest") return head();
    if (id === "l1_accepted") {
      if (state.finalityDown) throw new Error("accepted block unavailable");
      return state.accepted;
    }
    if (typeof id === "number") return id;
    const found = state.blocks.findIndex((block) => BigInt(block.hash) === BigInt(id));
    if (found < 0) throw Object.assign(new Error("Block not found"), { code: 24 });
    return found;
  };
  const has = (tx: string, at: number) => state.blocks.slice(0, at + 1).some((block) => block.txs.includes(tx));
  const labels = (at: number) =>
    state.blocks
      .slice(0, at + 1)
      .flatMap((block) => block.txs)
      .filter((tx) => tx.startsWith("deposit:"))
      .map((tx) => tx.slice("deposit:".length));
  return {
    state,
    reset,
    head,
    numberOf,
    has,
    labels,
    send: (tx: string) => {
      if (state.failBefore.delete(tx)) throw new Error("node unavailable");
      state.sent.push(tx);
      state.blocks.push({ hash: `0x${state.blocks.length.toString(16)}b${state.salt}`, txs: [tx] });
      if (state.loseReply.delete(tx)) state.lost = true;
    },
    /** Replaces every block Ethereum has not accepted: the transactions in them are gone. */
    rewrite: () => {
      state.salt++;
      for (let number = state.accepted + 1; number < state.blocks.length; number++)
        state.blocks[number] = { hash: `0x${number.toString(16)}c${state.salt}`, txs: [] };
    },
    finalize: () => {
      state.accepted = head();
    },
    canonical: (tx: string) => state.blocks.filter((block) => block.txs.includes(tx)).length,
  };
});

const payerOf = (label: string) => (label === "B" ? "0x44" : "0x33");
const paymentOf = (label: string, id: number, status: "pending" | "delivered" | "cancelled") => ({
  shard: "0x2",
  id: String(id),
  gameId: label === "D" ? 8 : 7,
  games: "0x20",
  account: ACCOUNT,
  realmsId: "0x77",
  home: "17",
  payer: payerOf(label),
  amount: "40",
  paidAt: label === "C" ? "1000" : label === "D" ? "1001" : "999",
  status,
});
const depositStatus = (label: string, at: number): "pending" | "delivered" | "cancelled" =>
  world.has(`resolve:${label}:cancelled`, at)
    ? "cancelled"
    : world.has(`resolve:${label}:delivered`, at)
      ? "delivered"
      : "pending";
const statusNumber = { pending: "0", delivered: "1", cancelled: "2" } as const;
const depositFields = (label: string, id: number, at: number) => {
  const payment = paymentOf(label, id, depositStatus(label, at));
  return [
    String(payment.gameId),
    "0x20",
    ACCOUNT,
    "0x77",
    "17",
    payment.payer,
    "40",
    payment.paidAt,
    statusNumber[payment.status],
  ];
};
const frontier = response(ledgerAbi, "get_frontier", {
  prize_pool: { low: 0, high: 0 },
  prize_paid: { low: 0, high: 0 },
  funded: true,
  start: 10,
  end: 100,
  pool: { low: 700n * 10n ** 18n, high: 0 },
  paid: { low: 0, high: 0 },
  closed: true,
  preset_id: 6,
  seed: 153,
});
const preset = response(ledgerAbi, "get_preset", {
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
    const number = world.numberOf(id);
    if (number > world.head()) throw Object.assign(new Error("Block not found"), { code: 24 });
    return {
      block_number: number,
      block_hash: world.state.blocks[number]!.hash,
      timestamp: 1000 + number,
      status: number <= world.state.accepted ? "ACCEPTED_ON_L1" : "ACCEPTED_ON_L2",
    };
  };
  const ledger = {
    getChainId: async () => "0x1",
    getBlock: async (id: number | string) => block(id),
    waitForTransaction: async () => ({ isReverted: () => false }),
    callContract: async (
      { entrypoint, calldata }: { entrypoint: string; calldata: string[] },
      at: number | string = "latest",
    ) => {
      const number = world.numberOf(at);
      if (entrypoint === "deposit_count") return [String(world.labels(number).length)];
      if (entrypoint === "get_deposit") {
        const id = Number(BigInt(calldata[1]!));
        const label = world.labels(number)[id - 1];
        return label ? depositFields(label, id, number) : ["0", "0", "0", "0", "0", "0", "0", "0", "0"];
      }
      if (entrypoint === "principal_payment")
        return world.has(`principal:${BigInt(calldata[2]!)}`, number) ? ["0", "0x50", "60"] : ["1"];
      if (entrypoint === "get_payment")
        return world.has("report:0xabc", number)
          ? [world.has("pay:0xabc", number) ? "1" : "0", "4", "0x123", "17", "0", "0", "0", "1"]
          : ["0", "0", "0", "0", "0", "0", "0", "0"];
      if (entrypoint === "get_frontier") return frontier;
      if (entrypoint === "get_preset") return preset;
      throw new Error(`unexpected view ${entrypoint}`);
    },
  };
  const shard = {
    getChainId: async () => "0x2",
    getBlock: async () => ({ ...block("latest"), status: "ACCEPTED_ON_L2" }),
  };
  return { ...real, rpcAt: (url: string) => (url.includes("ledger") ? ledger : shard) };
});
vi.mock("starknet", async (original) => ({
  ...(await original<typeof import("starknet")>()),
  Account: class {
    execute = async ({ entrypoint, calldata }: { entrypoint: string; calldata: string[] }) => {
      if (entrypoint === "resolve_deposit") {
        const label = world.labels(world.head())[Number(BigInt(calldata[1]!)) - 1];
        if (!label) throw new Error("Ledger: unknown deposit");
        world.send(`resolve:${label}:${calldata[2] === "1" ? "cancelled" : "delivered"}`);
      } else if (entrypoint === "pay_principal") world.send(`principal:${BigInt(calldata[2]!)}`);
      else throw new Error(`unexpected write ${entrypoint}`);
      if (world.state.lost) {
        world.state.lost = false;
        throw new Error("lost reply");
      }
      return { transaction_hash: "0x11" };
    };
  },
}));
vi.mock("@realms-world/value-ledger/shard", () => ({
  ShardOperator: class {
    provider = {
      callContract: async ({ calldata }: { calldata: string[] }) => {
        const id = String(BigInt(calldata[1]!));
        const game = Number(BigInt(calldata[0]!));
        const receipt = world.state.shardReceipts.get(`${game}:${id}`);
        if (!receipt) return ["1"];
        const label = world.labels(world.head())[Number(id) - 1];
        const payment = { ...paymentOf(label ?? "?", Number(id), "pending"), gameId: game };
        // What the shard holds is what it was told when it credited: the payer it saw, not the ledger's current one.
        return [
          "0",
          depositCommitment(
            { chainId: "0x1", ledger: "0x10" },
            { ...payment, payer: receipt.payer, paidAt: receipt.paidAt },
          ),
          ACCOUNT,
          "40",
          receipt.cancelled ? "1" : "0",
        ];
      },
    };
    admin = async (
      method: string,
      args: { game_id?: number; deposit?: { id: string; payer: string; paid_at: string }; cancel?: boolean },
    ) => {
      if (world.state.shardDown) throw new Error("shard unavailable");
      if (method === "deliver_deposit")
        world.state.shardReceipts.set(`${args.game_id}:${BigInt(args.deposit!.id)}`, {
          cancelled: !!args.cancel,
          payer: args.deposit!.payer,
          paidAt: args.deposit!.paid_at,
        });
      return { transactionHash: "0x1", events: [] };
    };
  },
}));
vi.mock("./shard-rpc", async (original) => ({
  ...(await original<typeof import("./shard-rpc")>()),
  ShardReader: class {
    header = async () => ({ timestamp: 100, block_number: 10 });
  },
}));
vi.mock("./frontier-games", () => ({
  readFrontierGames: async () => ({ confirmedBlock: 10, games: [{ game_id: 1, clock: { end_at: 100 } }] }),
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
  readConfirmedSnapshot: async () => ({
    confirmed_block: 10,
    game_id: "1",
    models: [
      { model: "LordsBudget", rows: [{ key: "b", value: { game_id: 1, pool: "700", pool_left: "700" } }] },
      { model: "FrontierPrize", rows: [{ key: "p", value: { game_id: 1, pool: "0", issued: "0", count: null } }] },
      { model: "ResourceBalance", rows: [] },
      { model: "LordsWithdrawal", rows: [] },
      { model: "SpendLords", rows: [] },
      { model: "PrincipalWithdrawal", rows: [{ key: "8", value: { game_id: 1, account: "0x8", amount: "60" } }] },
    ],
  }),
}));

// ---- storage that can be killed after any write ---------------------------------------------------------------------

class Killed extends Error {}
interface Kill {
  n: number;
  writes: number;
  dead?: boolean;
}
/** A storage over `data` that dies after applying its `n`th write (n = 0 never) and stays dead, as a killed worker does. */
const storageOver = (data: Map<string, unknown>, kill: Kill) => {
  const alive = () => {
    if (kill.dead) throw new Killed();
  };
  const wrote = () => {
    kill.writes++;
    if (kill.n > 0 && kill.writes === kill.n) {
      kill.dead = true;
      throw new Killed();
    }
  };
  const storage = {
    get: async <A>(key: string) => (alive(), structuredClone(data.get(key)) as A | undefined),
    put: async (key: string, value: unknown) => {
      alive();
      data.set(key, structuredClone(value));
      wrote();
    },
    delete: async (key: string) => {
      alive();
      const had = data.delete(key);
      wrote();
      return had;
    },
    list: async <A>({
      prefix,
      reverse,
      limit,
      end,
      startAfter,
    }: {
      prefix: string;
      reverse?: boolean;
      limit?: number;
      end?: string;
      startAfter?: string;
    }) => {
      alive();
      const keys = [...data.keys()]
        .filter((key) => key.startsWith(prefix) && (!end || key < end) && (!startAfter || key > startAfter))
        .sort();
      if (reverse) keys.reverse();
      return new Map(keys.slice(0, limit).map((key) => [key, structuredClone(data.get(key)) as A]));
    },
    /** A transaction commits whole or not at all, as a Durable Object's does: a kill inside it commits nothing. */
    transaction: async <A>(run: (tx: unknown) => Promise<A>) => {
      const before = new Map(data);
      const writes = kill.writes;
      try {
        return await run(storage);
      } catch (error) {
        data.clear();
        for (const [key, value] of before) data.set(key, value);
        kill.writes = writes;
        throw error;
      }
    },
  };
  return storage;
};

// ---- the worker: one pass of everything the relay owes --------------------------------------------------------------

const target = {
  chainId: "0x2",
  rpcUrl: "https://shard.test",
  gamesAddress: "0x20",
  firstRelease: 1,
  accountAddress: "0x5",
  privateKey: "0x6",
};
const withdrawal: Withdrawal = {
  prizeRank: 0,
  prizeCount: 0,
  chainId: "0x2",
  seasonId: 4,
  transactionHash: "0xabc",
  realmsId: "0x2",
  amount: "17",
  confirmedAt: 1000,
};
const credentials = {
  rpcUrl: "https://ledger.test",
  contractAddress: "0x10",
  accountAddress: "0x20",
  privateKey: "0x30",
};
const sign = async () => ({ r: "0x1", s: "0x2" });
const seedBlock: ConfirmedBlock = {
  chainId: "0x2",
  number: 0,
  hash: "0xa",
  parentHash: "0x0",
  status: "ACCEPTED_ON_L2",
  withdrawals: [withdrawal],
  results: [],
};
const ERRORS: string[] = [];

/**
 * Whenever a deposit is queued and not awaiting proof, the pass must say so: the worker takes "nothing pending" at its word
 * and does not look again until the hour. The store is the truth the summary is checked against.
 */
async function summaryAgreesWithStore(
  storage: { get<A>(key: string): Promise<A | undefined> },
  result: { pending: number; more: boolean },
) {
  const progress = [...(await progressOf(storage))];
  const todo = (
    await Promise.all(
      progress.map(
        async (entry) =>
          (await storage.get<true>(`obligation:deposit:2:${BigInt(entry.id)}:${entry.commitment}`)) !== true,
      ),
    )
  ).filter(Boolean).length;
  if (todo > 0 && !(result.pending > 0 && result.more))
    throw new Error(`summary_disagrees: ${todo} queued, ${JSON.stringify(result)}`);
}
const progressOf = async (storage: { get<A>(key: string): Promise<A | undefined> }) =>
  (await storage.get<{ open: { id: string; commitment: string }[] }>("deposits:1:16:progress"))?.open ?? [];

/** What a pass of the three paths does, with a worker built fresh over `data`, as a restart would. */
function worker(data: Map<string, unknown>, kill: Kill) {
  const storage = storageOver(data, kill);
  const store = new DurableRelayStore(storage as never);
  const anchors = {
    getAnchor: (key: string) => storage.get(key) as never,
    putAnchor: (key: string, value: unknown) => storage.put(key, value) as never,
  };
  const failure = (operation: string) => Effect.fail(new RelayFailure({ operation }));
  const ports: RelayPorts = {
    identity: { linkedWallet: () => Effect.succeed("0x123") } as never,
    shard: { confirmedHead: () => Effect.succeed(0), blockHash: () => Effect.succeed("0xa") } as never,
    ledger: {
      payment: ledgerPaymentRead("https://ledger.test", "0x10"),
      paymentProof: ledgerPaymentProof("https://ledger.test", "0x10"),
      voided: () => Effect.succeed(false),
      reportMany: (rows: readonly Withdrawal[]) => {
        world.send("report:0xabc");
        return world.state.lost
          ? ((world.state.lost = false), failure("lost reply"))
          : Effect.succeed(rows.map((row) => ({ claimId: row.transactionHash, error: null })));
      },
      payMany: (rows: readonly { withdrawal: Withdrawal }[]) => {
        world.send("pay:0xabc");
        return world.state.lost
          ? ((world.state.lost = false), failure("lost reply"))
          : Effect.succeed(rows.map((row) => ({ claimId: row.withdrawal.transactionHash, error: null })));
      },
      postResult: () => Effect.void,
    } as never,
  };
  const depositPorts = (proofs: boolean): DepositRelayPorts => ({
    target,
    heraldUrl: "https://herald.test",
    ledger: { rpcUrl: "https://ledger.test", address: "0x10", chainId: "0x1" },
    storage: storage as never,
    finals: durableFinalFacts(storage as never),
    obligations: storage as never,
    proofs,
    sign,
    mutate: (request) => mutateDeposit(credentials, "0x1", request, sign, anchors, async () => "0x50"),
  });
  const principal = async (claim: { chainId: string; gameId: number; account: string; amount: string }) =>
    (
      await mutateDeposit(
        credentials,
        "0x1",
        { kind: "principal", shard: claim.chainId, season: claim.gameId, account: claim.account, amount: claim.amount },
        sign,
        anchors,
        async () => "0x50",
      )
    ).final;
  /** Each part runs and fails on its own, as the worker's tick runs them. */
  const pass = async (proofs: boolean) => {
    const part = async (work: () => Promise<unknown>) => {
      try {
        await work();
      } catch (error) {
        if (!kill.dead) ERRORS.push(error instanceof Error ? error.message : String(error));
      }
    };
    if (!(await storage.get("seeded").catch(() => true))) {
      await part(async () => {
        await store.observe(seedBlock);
        await storage.put("seeded", true);
      });
    }
    await part(async () => {
      // The worker's own decision: it looks at deposits on a proof pass, when the last pass left work, or never looked.
      const last = await storage.get<{ deposits?: Parameters<typeof depositsSettled>[0] & { faults?: string[] } }>(
        "shardTick",
      );
      if (!proofs && last?.deposits && depositsSettled(last.deposits)) {
        // Skipped: what the health route serves is the last observation, faults included.
        if (last.deposits.faults?.length) throw new Error(last.deposits.faults.join(","));
        return;
      }
      const result = await relayDeposits(depositPorts(proofs));
      await storage.put("shardTick", { deposits: result });
      await summaryAgreesWithStore(storage, result);
      const published = [...(result.error ? [JSON.stringify(result.error)] : []), ...result.faults];
      if (published.length) throw new Error(published.join(" | "));
    });
    await part(() =>
      sweepFrontierLords(
        target,
        "https://herald.test",
        {
          rpcUrl: "https://ledger.test",
          address: "0x30",
          finals: durableFinalFacts(storage as never),
          obligations: storage as never,
          proofs,
        },
        async () => {},
        principal,
      ),
    );
    await part(() => Effect.runPromise(runRelay("0x2", ports, store, proofs)));
  };
  return { pass, depositPorts };
}

// ---- the matrix ----------------------------------------------------------------------------------------------------

type Beat = () => void;
interface Step {
  proofs: boolean;
  before?: Beat[];
}
interface Scenario {
  name: string;
  /** The chain events, as beats before steps of the schedule. */
  steps: Step[];
  start?: Beat[];
  /** The deposit that vanishes, if any. */
  vanishes?: "B";
  /**
   * A deposit arrives only after everything else has settled and takes the id the vanished one had: C in the same game
   * (a real commitment conflict with the shard's receipt), D in another game (no conflict at all).
   */
  late?: "C" | "D";
  /** The deposit arrives within the schedule, before the relay has noticed the vanished one: the count never changes. */
  arrivesInSchedule?: boolean;
  /** The accepted block never becomes readable: work known to be undone must still be done; nothing can settle. */
  neverFinal?: boolean;
  /** Checks that must hold right after a step of an uninterrupted run: work that failed is redone on the next minute. */
  after?: Record<number, () => void>;
}
/** A later deposit, unrelated to the failure, arrives and is accepted. */
const arrive =
  (label: "C" | "D"): Beat =>
  () => {
    world.send(`deposit:${label}`);
    world.finalize();
  };
const arriveC = arrive("C");
const schedule = (events: Partial<Record<number, Beat[]>>, late = false): Step[] =>
  [false, false, true, false, true, false, true].map((proofs, index) => ({
    proofs,
    before: [...(index === 2 && !late ? [arriveC] : []), ...(events[index] ?? [])],
  }));
const scenarios: Scenario[] = [
  { name: "nothing happens", steps: schedule({}) },
  {
    name: "the unaccepted blocks are replaced",
    steps: schedule({ 1: [() => world.rewrite()], 3: [() => world.rewrite()] }),
  },
  {
    name: "a deposit vanishes with its block",
    steps: schedule({ 1: [() => world.rewrite()] }, true),
    vanishes: "B",
    late: "D",
  },
  {
    name: "a deposit vanishes after the shard credited it and the same game reuses its id",
    steps: schedule({ 1: [() => world.rewrite()] }, true),
    vanishes: "B",
    late: "C",
  },
  {
    name: "a credited deposit is replaced by one of another game before the relay notices (the count never changes)",
    steps: schedule({ 1: [() => world.rewrite(), arrive("D")] }, true),
    vanishes: "B",
    late: "D",
    arrivesInSchedule: true,
  },
  {
    name: "a credited deposit is replaced by one of the same game before the relay notices (a real commitment conflict)",
    steps: schedule({ 1: [() => world.rewrite(), arrive("C")] }, true),
    vanishes: "B",
    late: "C",
    arrivesInSchedule: true,
  },
  {
    name: "an uncredited deposit is replaced by another before the relay notices",
    after: {
      // The pass that noticed the replacement (step 2) queued the new deposit; the very next minute (step 3) delivers it.
      2: () => expect(world.canonical("resolve:D:delivered"), "the replacement, one minute after it was found").toBe(1),
    },
    steps: [
      { proofs: false },
      {
        proofs: false,
        before: [() => world.rewrite(), arrive("D"), () => void (world.state.shardDown = false)],
      },
      { proofs: false },
      { proofs: false },
      { proofs: true },
      { proofs: false },
      { proofs: true },
    ],
    start: [() => void (world.state.shardDown = true)],
    vanishes: "B",
    late: "D",
    arrivesInSchedule: true,
  },
  {
    name: "a deposit vanishes before the shard was told of it",
    steps: [
      { proofs: false },
      { proofs: false, before: [() => world.rewrite(), () => void (world.state.shardDown = false)] },
      ...schedule({}, true).slice(2),
    ],
    start: [() => void (world.state.shardDown = true)],
    vanishes: "B",
    late: "C",
  },
  {
    name: "the accepted block cannot be read while blocks are replaced",
    steps: schedule({
      1: [() => world.rewrite(), () => void (world.state.finalityDown = true)],
      5: [() => void (world.state.finalityDown = false)],
    }),
  },
  {
    name: "the accepted block is never readable while blocks are replaced",
    steps: schedule({
      1: [() => world.rewrite(), () => void (world.state.finalityDown = true)],
      3: [() => world.rewrite()],
    }),
    neverFinal: true,
  },
  {
    name: "the work is redone after a replacement but the node fails before it reaches the chain",
    after: {
      // The hourly pass (step 3) failed before sending; the very next minute (step 4) must have redone all of it.
      3: () => {
        expect(world.canonical("resolve:A:delivered"), "deposit A redone the next minute").toBe(1);
        expect(world.canonical("resolve:B:cancelled"), "deposit B redone the next minute").toBe(1);
        expect(world.canonical("principal:8"), "principal redone the next minute").toBe(1);
      },
    },
    steps: schedule({
      1: [
        () => world.rewrite(),
        () =>
          ["resolve:A:delivered", "resolve:B:cancelled", "principal:8", "pay:0xabc", "report:0xabc"].forEach((tx) =>
            world.state.failBefore.add(tx),
          ),
      ],
    }),
  },
  {
    name: "every first reply is lost",
    steps: schedule({}),
    start: [
      () =>
        ["resolve:A:delivered", "resolve:B:cancelled", "principal:8", "pay:0xabc", "report:0xabc"].forEach((tx) =>
          world.state.loseReply.add(tx),
        ),
    ],
  },
];

/**
 * Runs a scenario's whole schedule: its steps, then time passing (Ethereum accepts what the chain holds and the hourly
 * proof passes look again), then the late deposit if there is one. Every pass is in the kill matrix: killing after write
 * `killAt` of pass `killStep` (1-based over the whole schedule; 0: never).
 */
async function run(scenario: Scenario, killStep: number, killAt: number) {
  world.reset();
  ERRORS.length = 0;
  // Deposit B was accepted from the start, except in the scenarios where it vanishes with its block.
  if (scenario.vanishes) {
    world.state.blocks[6]!.txs = [];
    world.send("deposit:B");
  }
  scenario.start?.forEach((beat) => beat());
  const settle: Step[] = Array.from({ length: 8 }, () => ({
    proofs: true,
    before: [
      () => {
        if (!scenario.neverFinal) world.state.finalityDown = false;
        world.finalize();
      },
    ],
  }));
  const late: Step[] =
    scenario.late && !scenario.arrivesInSchedule
      ? Array.from({ length: 4 }, (_, index) => ({
          proofs: true,
          before: [...(index === 0 ? [arrive(scenario.late!)] : []), () => world.finalize()],
        }))
      : [];
  const steps = [...scenario.steps, ...settle, ...late];
  const data = new Map<string, unknown>();
  const writes: number[] = [];
  const stepErrors: string[][] = [];
  let creditedBeforeVanish = false;
  let beforeLate: Record<string, unknown> = {};
  for (const [index, step] of steps.entries()) {
    if (scenario.vanishes && index === 1) creditedBeforeVanish = world.state.shardReceipts.has("7:2");
    if (scenario.late && !scenario.arrivesInSchedule && index === scenario.steps.length + settle.length)
      beforeLate = {
        a: world.canonical("resolve:A:delivered"),
        proofs: [...data.keys()].filter((key) => key.startsWith("proof:")).length,
        withdrawal: world.canonical("pay:0xabc"),
        principal: world.canonical("principal:8"),
      };
    step.before?.forEach((beat) => beat());
    const kill: Kill = { n: index + 1 === killStep ? killAt : 0, writes: 0 };
    ERRORS.length = 0;
    await worker(data, kill).pass(step.proofs);
    if (killStep === 0) scenario.after?.[index]?.();
    writes.push(kill.writes);
    stepErrors.push([...ERRORS]);
  }
  if (!scenario.late || scenario.arrivesInSchedule)
    beforeLate = {
      a: world.canonical("resolve:A:delivered"),
      proofs: [...data.keys()].filter((key) => key.startsWith("proof:")).length,
      withdrawal: world.canonical("pay:0xabc"),
      principal: world.canonical("principal:8"),
    };
  return {
    data,
    writes,
    stepErrors,
    creditedBeforeVanish,
    beforeLate,
    killStep,
    lateFrom: scenario.steps.length + settle.length,
  };
}

const history = async (data: Map<string, unknown>) =>
  (await depositHistory(worker(data, { n: 0, writes: 0 }).depositPorts(false), "0x77")).rows
    .map(({ id, status }) => [id, status] as const)
    .sort((a, b) => Number(a[0]) - Number(b[0]));

/** What the accepted chain holds, for the deposits it holds. */
const chainHistory = (at: number) =>
  world.labels(at).map((label, index) => [String(index + 1), depositStatus(label, at)] as const);

const faultsIn = (data: Map<string, unknown>) =>
  [...data.entries()]
    .filter(([key]) => key.startsWith("deposit-fault:"))
    .map(
      ([, value]) =>
        value as { id: string; commitment: string; row: { payer: string; gameId: number }; reason: string },
    );

async function expectOutcome(scenario: Scenario, outcome: Awaited<ReturnType<typeof run>>) {
  const { data, stepErrors, creditedBeforeVanish, beforeLate, killStep, lateFrom } = outcome;
  /** The pass that was killed publishes nothing; every other pass is held to the assertion. */
  const published = (from: number) =>
    stepErrors
      .map((errors, index) => ({ errors, index }))
      .filter(({ index }) => index >= from && index + 1 !== killStep);
  const tainted = !!scenario.vanishes && creditedBeforeVanish;
  const note = `errors: ${stepErrors.map((step) => step.join(",")).join(" | ")}`;
  // Whenever a deposit was queued and waiting for an attempt, the pass that returned said so.
  expect(
    stepErrors.flat().filter((error) => error.includes("summary_disagrees")),
    note,
  ).toEqual([]);
  // Before anything arrives to reuse the vanished id, the unrelated work has already completed and nothing is stuck.
  expect(beforeLate, "before the late deposit").toMatchObject({
    a: 1,
    withdrawal: 1,
    principal: 1,
    ...(scenario.neverFinal ? {} : { proofs: 0 }),
  });
  // Unrelated work always completes: the withdrawal, the principal and the deposit that was final from the start.
  expect(world.canonical("report:0xabc"), "report").toBe(1);
  expect(world.canonical("pay:0xabc"), "payment").toBe(1);
  expect(world.canonical("principal:8"), "principal").toBe(1);
  expect(world.canonical("resolve:A:delivered"), "deposit A").toBe(1);
  if (!scenario.neverFinal) {
    expect([...data.keys()].filter((key) => key.startsWith("proof:"))).toEqual([]);
    expect(data.has("final:withdrawal:0xabc")).toBe(true);
  }
  if (tainted) {
    // The shard credited a deposit the ledger no longer has: its fault is kept with its evidence and reported on every
    // pass from the time it was found, and it stops nothing.
    const faults = faultsIn(data);
    expect(faults, note).toHaveLength(1);
    expect(faults[0]!.row).toMatchObject({ payer: "0x44", gameId: 7 });
    for (const { errors, index } of published(scenario.steps.length))
      expect(
        errors.some((error) => /deposit_(vanished|replaced)_after_credit/.test(error)),
        `pass ${index + 1}: ${note}`,
      ).toBe(true);
    if (scenario.late === "D") {
      // Another game takes the id: nothing conflicts, so it is resolved exactly once, and only the fault is reported.
      expect(world.canonical("resolve:D:delivered"), "the deposit of another game").toBe(1);
      for (const { errors } of published(lateFrom + 2))
        expect(
          errors.every((error) => /deposit_(vanished|replaced)_after_credit/.test(error)),
          note,
        ).toBe(true);
    }
    if (scenario.late === "C") {
      // The same game takes the id: a real conflict with the shard's receipt, loud for that deposit alone, every pass.
      expect(world.canonical("resolve:C:delivered") + world.canonical("resolve:C:cancelled")).toBe(0);
      for (const { errors } of published(lateFrom + 1))
        expect(
          errors.some((error) => error.includes("deposit_resolution_unconfirmed")),
          note,
        ).toBe(true);
    }
    // The fault is answered by its commitment, and nothing else is touched.
    const before = faultsIn(data);
    const k = worker(data, { n: 0, writes: 0 });
    void k;
    expect(before[0]!.commitment).toMatch(/^0x/);
    return;
  }
  // No error survives: the last passes are clean.
  expect(
    stepErrors.slice(-3).map((errors) => errors.length),
    note,
  ).toEqual([0, 0, 0]);
  if (scenario.late) expect(world.canonical(`resolve:${scenario.late}:delivered`), "late deposit").toBe(1);
  else expect(world.canonical("resolve:C:delivered"), "deposit C").toBe(1);
  if (scenario.vanishes) {
    expect(world.canonical("deposit:B")).toBe(0);
    expect(world.canonical("resolve:B:cancelled") + world.canonical("resolve:B:delivered")).toBe(0);
  } else {
    expect(world.canonical("resolve:B:cancelled"), "deposit B refund").toBe(1);
    expect(world.canonical("resolve:B:delivered")).toBe(0);
  }
  const progress = [...data.entries()].find(([key]) => key.endsWith(":progress"))![1] as { open: unknown[] };
  if (!scenario.neverFinal) expect(progress.open).toEqual([]);
  expect(faultsIn(data)).toEqual([]);
  expect(await history(data)).toEqual(chainHistory(scenario.neverFinal ? world.head() : world.state.accepted));
}

beforeEach(() => world.reset());

for (const scenario of scenarios) {
  it(`${scenario.name}: every durable write of every pass, killed there, ends in one canonical outcome`, async () => {
    const dry = await run(scenario, 0, 0);
    expect(dry.writes.reduce((all, count) => all + count, 0)).toBeGreaterThan(20);
    await expectOutcome(scenario, dry);
    for (const [index, writes] of dry.writes.entries())
      for (let killAt = 1; killAt <= writes; killAt++) {
        await new Promise((resolve) => setImmediate(resolve));
        const outcome = await run(scenario, index + 1, killAt);
        await expectOutcome(scenario, outcome).catch((error) => {
          throw new Error(
            `${scenario.name}: killed after write ${killAt} of pass ${index + 1}: ${error.message} [${outcome.stepErrors.map((step) => step.join(",")).join(" | ")}]`,
          );
        });
      }
  }, 900_000);
}
