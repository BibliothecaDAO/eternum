vi.mock("../../../packages/value-ledger/src/shard-abi", () => ({
  readShardAbi: async () => [{ type: "interface", items: [{ name: "deposit_source" }] }],
}));
import { beforeEach, expect, it, vi } from "vitest";
import { Effect } from "effect";
import { runMonitor, type MonitorProgress } from "./monitor";
import type { MonitorPorts } from "./ports";
import { memoryFinalFacts } from "./final-facts";
import { sweepFrontierLords } from "./frontier-sweep";
import { awardFrontierPrizes } from "./frontier-prizes";
import { publishFrontierPools } from "./frontier-pools";

const reads = vi.hoisted(() => ({
  funding: vi.fn(),
  ledgerHead: vi.fn(),
  pay: vi.fn(),
  games: vi.fn(),
  snapshot: vi.fn(),
}));
vi.mock("@realms-world/value-ledger", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger")>()),
  rpcAt: vi.fn(),
  readFrontierFunding: reads.funding,
  readConfirmedLedgerHead: reads.ledgerHead,
}));
vi.mock("@realms-world/value-ledger/shard", () => ({
  ShardOperator: class {
    admin = vi.fn();
  },
}));
vi.mock("./shard-rpc", async (original) => ({
  ...(await original<typeof import("./shard-rpc")>()),
  ShardReader: class {
    header = async () => ({ timestamp: 100 });
  },
}));
vi.mock("./frontier-games", () => ({ readFrontierGames: reads.games, frontierTerms: () => ({ end: 100 }) }));
vi.mock("./shard-snapshot", async (original) => ({
  ...(await original<typeof import("./shard-snapshot")>()),
  readConfirmedSnapshot: reads.snapshot,
}));
const target = {
  chainId: "0x1",
  rpcUrl: "https://shard.test",
  gamesAddress: "0x10",
  firstRelease: 1,
  accountAddress: "0x20",
  privateKey: "0x1",
};
const PRINCIPALS_PER_GAME = 3;
const wei = (amount: number) => String(BigInt(amount) * 10n ** 18n);

/** Ended games whose season is closed on the ledger, each with returned principals and an unissued prize. */
function endedClosedGames(count: number) {
  reads.games.mockResolvedValue({
    confirmedBlock: 10,
    games: Array.from({ length: count }, (_, index) => ({ game_id: index + 1, clock: { end_at: 100 } })),
  });
  reads.snapshot.mockImplementation(async (_target: unknown, _herald: string, gameId: number) => ({
    confirmed_block: 10,
    game_id: String(gameId),
    models: [
      { model: "LordsBudget", rows: [{ key: "b", value: { game_id: gameId, pool: "700", pool_left: "700" } }] },
      {
        model: "FrontierPrize",
        rows: [{ key: "p", value: { game_id: gameId, pool: "300", issued: "0", count: null } }],
      },
      { model: "ResourceBalance", rows: [] },
      { model: "LordsWithdrawal", rows: [] },
      { model: "SpendLords", rows: [] },
      {
        model: "PrincipalWithdrawal",
        rows: Array.from({ length: PRINCIPALS_PER_GAME }, (_, index) => ({
          key: String(index),
          value: { game_id: gameId, account: `0x${index + 8}`, amount: "40" },
        })),
      },
    ],
  }));
}

/** One shard tick of the relay's Frontier jobs, and what it asked of the ledger. */
async function tick(ledger: { rpcUrl: string; address: string; finals: ReturnType<typeof memoryFinalFacts> }) {
  reads.funding.mockClear();
  reads.ledgerHead.mockClear();
  reads.pay.mockClear();
  await publishFrontierPools(target, "https://herald.test", ledger);
  await awardFrontierPrizes(target, "https://herald.test", ledger);
  await sweepFrontierLords(target, "https://herald.test", ledger, async () => {}, reads.pay);
  return {
    funding: reads.funding.mock.calls.length,
    head: reads.ledgerHead.mock.calls.length,
    paid: reads.pay.mock.calls.length,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  reads.ledgerHead.mockResolvedValue({ number: 10, time: 1_000_000 });
  reads.funding.mockResolvedValue({ closed: true, pool: wei(700), prizePool: wei(300), claimDeadline: 101 });
  reads.pay.mockResolvedValue(undefined);
});

it.each([1, 4, 20])(
  "with %i ended closed games, the second tick reads nothing a first tick already settled",
  async (games) => {
    endedClosedGames(games);
    const ledger = { rpcUrl: "https://ledger.test", address: "0x30", finals: memoryFinalFacts() };

    const first = await tick(ledger);
    // The prize job reads each game's season once and learns it is closed; the sweep then has nothing to ask.
    expect(first).toEqual({ funding: games, head: 0, paid: games * PRINCIPALS_PER_GAME });

    for (const later of [await tick(ledger), await tick(ledger)]) {
      expect(later).toEqual({ funding: 0, head: 0, paid: 0 });
    }
  },
);

it("a principal whose payment failed is asked again, and only that one", async () => {
  endedClosedGames(1);
  const ledger = { rpcUrl: "https://ledger.test", address: "0x30", finals: memoryFinalFacts() };
  reads.pay.mockRejectedValueOnce(new Error("principal_wallet_unavailable"));
  await expect(tick(ledger)).rejects.toThrow("principal_wallet_unavailable");
  const retry = await tick(ledger);
  expect(retry.paid).toBe(1);
  expect(retry.funding + retry.head).toBe(0);
});

const page = { rows: [], next: null, head: 10, anchor: { number: 10, hash: "0xa" }, rewind: false, fromBlock: 1 };

/** One audit of the monitor over funded games, and how many pools it asked the ledger about. */
function auditPoolReads(games: number, audits: number) {
  const poolReads = vi.fn(() => Effect.succeed(String(100n * 10n ** 18n)));
  const ports: MonitorPorts = {
    identity: { matchesPayDecision: () => Effect.succeed(true) },
    shard: {
      withdrawalReceipt: () => Effect.succeed(null),
      conservation: () =>
        Effect.succeed(
          Array.from({ length: games }, (_, index) => ({
            chainId: "0x1",
            gameId: index + 1,
            confirmedBlock: 10 + audits,
            receipts: "0",
            netIssued: "0",
            pool: "100",
          })),
        ),
      withdrawal: () => Effect.succeed(null),
      result: () => Effect.succeed(null),
    },
    ledger: {
      frontierPool: poolReads,
      reportedClaims: () => Effect.succeed(page),
      paidClaims: () => Effect.succeed(page),
      postedResults: () => Effect.succeed(page),
      pause: () => Effect.void,
    },
  };
  let progress: MonitorProgress = { halted: null };
  const store = {
    load: async () => progress,
    save: async (next: MonitorProgress) => {
      progress = next;
    },
  };
  return (async () => {
    const perAudit: number[] = [];
    for (let audit = 0; audit < audits; audit++) {
      poolReads.mockClear();
      await Effect.runPromise(runMonitor(ports, store));
      perAudit.push(poolReads.mock.calls.length);
    }
    return perAudit;
  })();
}

it.each([1, 5, 30])("with %i funded games, the monitor matches each pool once and never again", async (games) => {
  expect(await auditPoolReads(games, 3)).toEqual([games, 0, 0]);
});
