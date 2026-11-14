/**
 * The invariant: anything the relay owes the chain or a player (a deposit to deliver or refund, a principal to return,
 * a withdrawal to pay) is durable work from the moment it is known until the accepted chain proves its outcome.
 *
 * This is the test that closes the class, not a list of cases. For every kind of obligation at once, it kills the worker
 * after every state write of a pass (a new worker over the same storage takes over), and replaces the unaccepted blocks
 * at every stage of the schedule. At the end each obligation has exactly one canonical resolution on the accepted chain,
 * is settled, and the history says what the chain says.
 */
vi.mock("./deposit-destination", () => ({
  supportsDeposits: async () => true,
  readDepositEvidence: async () => ({ remember: async () => {} }),
  depositDestinationError: async (_evidence: unknown, payment: { id: string }) => (payment.id === "2" ? "bad" : null),
  depositStructures: () => [],
}));
import { beforeEach, expect, it, vi } from "vitest";
import { Effect } from "effect";
import { depositCommitment } from "@realms-world/value-ledger/deposits";
import { response } from "../../../packages/value-ledger/test-support/abi";
import { ledgerAbi } from "../../../packages/value-ledger/test-support/ledger-abi";
import { realmsAccountAddress } from "../../../packages/identity/src/account";
import { depositHistory, relayDeposits, type DepositRelayPorts } from "./deposits";
import { mutateDeposit } from "./deposit-ledger";
import { durableFinalFacts } from "./final-facts";
import { sweepFrontierLords } from "./frontier-sweep";
import { runRelay } from "./relay";
import { DurableRelayStore } from "./state";
import type { ConfirmedBlock, RelayPorts, Withdrawal } from "./ports";

/** A ledger whose unaccepted blocks can be replaced; every transaction lives in the block that carried it. */
const world = vi.hoisted(() => {
  const state = {
    blocks: [] as { hash: string; txs: string[] }[],
    accepted: 9,
    salt: 0,
    shardReceipts: new Map<string, boolean>(),
    sent: [] as string[],
  };
  const reset = () => {
    state.salt = 0;
    state.accepted = 9;
    state.shardReceipts = new Map();
    state.sent = [];
    state.blocks = Array.from({ length: 11 }, (_, number) => ({ hash: `0x${number.toString(16)}a0`, txs: [] }));
  };
  reset();
  const head = () => state.blocks.length - 1;
  const numberOf = (id: number | string) => {
    if (id === "latest") return head();
    if (id === "l1_accepted") return state.accepted;
    if (typeof id === "number") return id;
    const found = state.blocks.findIndex((block) => BigInt(block.hash) === BigInt(id));
    if (found < 0) throw Object.assign(new Error("Block not found"), { code: 24 });
    return found;
  };
  const has = (tx: string, at: number) => state.blocks.slice(0, at + 1).some((block) => block.txs.includes(tx));
  return {
    state,
    reset,
    head,
    numberOf,
    has,
    send: (tx: string) => {
      state.sent.push(tx);
      state.blocks.push({ hash: `0x${state.blocks.length.toString(16)}b${state.salt}`, txs: [tx] });
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

const DEPOSIT_FIELDS = (id: string, status: number) => [
  "7",
  "0x20",
  realmsAccountAddress("0x77", "0x11", "0x22"),
  "0x77",
  "17",
  "0x33",
  "40",
  "999",
  String(status),
];
const depositStatus = (id: string, at: number) =>
  world.has(`resolve:${id}:cancelled`, at) ? 2 : world.has(`resolve:${id}:delivered`, at) ? 1 : 0;
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
      if (entrypoint === "deposit_count") return ["2"];
      if (entrypoint === "get_deposit")
        return DEPOSIT_FIELDS(calldata[1]!, depositStatus(String(BigInt(calldata[1]!)), number));
      if (entrypoint === "principal_payment")
        return world.has(`principal:${BigInt(calldata[2]!)}`, number) ? ["0", "0x50", "60"] : ["1"];
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
      if (entrypoint === "resolve_deposit")
        world.send(`resolve:${BigInt(calldata[1]!)}:${calldata[2] === "1" ? "cancelled" : "delivered"}`);
      else if (entrypoint === "pay_principal") world.send(`principal:${BigInt(calldata[2]!)}`);
      else throw new Error(`unexpected write ${entrypoint}`);
      return { transaction_hash: "0x11" };
    };
  },
}));
vi.mock("@realms-world/value-ledger/shard", () => ({
  ShardOperator: class {
    provider = {
      callContract: async ({ calldata }: { calldata: string[] }) => {
        const id = String(BigInt(calldata[1]!));
        const cancelled = world.state.shardReceipts.get(id);
        return cancelled === undefined
          ? ["1"]
          : [
              "0",
              depositCommitment(
                { chainId: "0x1", ledger: "0x10" },
                {
                  shard: "0x2",
                  id,
                  gameId: 7,
                  games: "0x20",
                  account: realmsAccountAddress("0x77", "0x11", "0x22"),
                  realmsId: "0x77",
                  home: "17",
                  payer: "0x33",
                  amount: "40",
                  paidAt: "999",
                  status: "pending",
                },
              ),
              realmsAccountAddress("0x77", "0x11", "0x22"),
              "40",
              cancelled ? "1" : "0",
            ];
      },
    };
    admin = async (method: string, args: { deposit?: { id: string }; cancel?: boolean }) => {
      if (method === "deliver_deposit") world.state.shardReceipts.set(String(BigInt(args.deposit!.id)), !!args.cancel);
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
/** A storage over `data` that throws after applying its `n`th write: the worker died there. n = 0 never dies. */
const storageOver = (data: Map<string, unknown>, killAfter: { n: number; writes: number; dead?: boolean }) => {
  const alive = () => {
    if (killAfter.dead) throw new Killed();
  };
  const wrote = () => {
    killAfter.writes++;
    if (killAfter.n > 0 && killAfter.writes === killAfter.n) {
      killAfter.dead = true;
      throw new Killed();
    }
  };
  const storage = {
    get: async (key: string) => (alive(), structuredClone(data.get(key))),
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
    list: async ({
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
      return new Map(keys.slice(0, limit).map((key) => [key, structuredClone(data.get(key))]));
    },
    /** A transaction commits whole or not at all, as a Durable Object's does. */
    transaction: async (run: (tx: unknown) => Promise<unknown>) => {
      const before = new Map(data);
      try {
        return await run(storage);
      } catch (error) {
        data.clear();
        for (const [key, value] of before) data.set(key, value);
        throw error;
      }
    },
  };
  return storage;
};

// ---- the worker: one pass of everything the relay owes -------------------------------------------------------------

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
const block: ConfirmedBlock = {
  chainId: "0x2",
  number: 0,
  hash: "0xa",
  parentHash: "0x0",
  status: "ACCEPTED_ON_L2",
  withdrawals: [withdrawal],
  results: [],
};

/** What a pass of the three paths does, with a worker built fresh over `data`, as a restart would. */
function worker(data: Map<string, unknown>, kill: { n: number; writes: number; dead?: boolean }) {
  const storage = storageOver(data, kill);
  const store = new DurableRelayStore(storage as never);
  const anchors = {
    getAnchor: (key: string) => storage.get(key) as never,
    putAnchor: (key: string, value: unknown) => storage.put(key, value) as never,
  };
  const ports: RelayPorts = {
    identity: { linkedWallet: () => Effect.succeed("0x123") } as never,
    shard: { confirmedHead: () => Effect.succeed(0), blockHash: () => Effect.succeed("0xa") } as never,
    ledger: {
      payment: () =>
        Effect.succeed(
          world.has("report:0xabc", world.head())
            ? {
                reportedAt: 1,
                paid: world.has("pay:0xabc", world.head()),
                seasonId: 4,
                wallet: "0x123",
                amount: "17",
                prizeRank: 0,
                prizeCount: 0,
              }
            : null,
        ),
      voided: () => Effect.succeed(false),
      reportMany: (rows: readonly Withdrawal[]) => {
        world.send("report:0xabc");
        return Effect.succeed(rows.map((row) => ({ claimId: row.transactionHash, error: null })));
      },
      payMany: (rows: readonly { withdrawal: Withdrawal }[]) => {
        world.send("pay:0xabc");
        return Effect.succeed(rows.map((row) => ({ claimId: row.withdrawal.transactionHash, error: null })));
      },
      paymentProof: () =>
        Effect.succeed({
          atHead: world.has("pay:0xabc", world.head()),
          final: world.has("pay:0xabc", world.state.accepted)
            ? { block: world.state.accepted, hash: world.state.blocks[world.state.accepted]!.hash }
            : null,
        }),
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
  const pass = async (proofs: boolean) => {
    if (!(await storage.get("seeded"))) {
      await store.observe(block);
      await storage.put("seeded", true);
    }
    await relayDeposits(depositPorts(proofs));
    await sweepFrontierLords(
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
      async (claim) =>
        (
          await mutateDeposit(
            credentials,
            "0x1",
            {
              kind: "principal",
              shard: claim.chainId,
              season: claim.gameId,
              account: claim.account,
              amount: claim.amount,
            },
            sign,
            anchors,
            async () => "0x50",
          )
        ).final,
    );
    await Effect.runPromise(runRelay("0x2", ports, store, proofs));
  };
  return { pass, depositPorts, storage };
}

const everything = {
  deposits: ["resolve:1:delivered", "resolve:2:cancelled"],
  principal: "principal:8",
  pay: "pay:0xabc",
};

/** The state a run must end in, whatever happened on the way. */
async function expectSettled(data: Map<string, unknown>) {
  const kill = { n: 0, writes: 0 };
  const { depositPorts } = worker(data, kill);
  for (const tx of [...everything.deposits, everything.principal, everything.pay, "report:0xabc"])
    expect(world.canonical(tx), tx).toBe(1);
  for (const tx of ["resolve:1:cancelled", "resolve:2:delivered"]) expect(world.canonical(tx), tx).toBe(0);
  const progress = [...data.entries()].find(([key]) => key.endsWith(":progress"))![1] as { open: string[] };
  expect(progress.open).toEqual([]);
  const history = await depositHistory(depositPorts(false), "0x77");
  expect(history.rows.map(({ id, status }) => [id, status])).toEqual([
    ["2", "cancelled"],
    ["1", "delivered"],
  ]);
  expect([...data.keys()].filter((key) => key.startsWith("proof:"))).toEqual([]);
  expect(data.has("final:withdrawal:0xabc")).toBe(true);
}

beforeEach(() => world.reset());

/** The schedule: a minute pass, then minute and proof passes with the unaccepted blocks replaced at `rewriteAt`. */
async function run(killAt: number, rewriteAt: number) {
  world.reset();
  const data = new Map<string, unknown>();
  const kill: { n: number; writes: number; dead?: boolean } = { n: killAt, writes: 0 };
  try {
    await worker(data, kill).pass(false);
  } catch (error) {
    if (!kill.dead) throw error;
  }
  const writes = kill.writes;
  for (let step = 1; step <= 6; step++) {
    if (step === rewriteAt) world.rewrite();
    await worker(data, { n: 0, writes: 0 }).pass(step % 2 === 0);
  }
  // Time passes: Ethereum accepts what the chain holds, and the relay's hourly proof passes look again.
  for (let step = 0; step < 6; step++) {
    world.finalize();
    await worker(data, { n: 0, writes: 0 }).pass(true);
  }
  await expectSettled(data);
  return writes;
}

it("settles every kind of obligation exactly once whatever dies or is replaced, at every state write and stage", async () => {
  const total = await run(0, 0);
  expect(total).toBeGreaterThan(20);
  console.log("WRITES", total);
  for (const rewriteAt of [0, 1, 3, 5])
    for (let kill = 1; kill <= total; kill++)
      await run(kill, rewriteAt).catch((error) => {
        throw new Error(`killed after write ${kill}, blocks replaced at pass ${rewriteAt}: ${error.message}`);
      });
}, 300_000);

it("sends one canonical payment per obligation even when a replaced block took the first", async () => {
  await run(0, 2);
  // Each obligation was sent again after its block was replaced, and settled only when the accepted chain held it.
  expect(world.state.sent.filter((tx) => tx === everything.principal).length).toBeGreaterThanOrEqual(1);
  expect(world.canonical(everything.principal)).toBe(1);
});
