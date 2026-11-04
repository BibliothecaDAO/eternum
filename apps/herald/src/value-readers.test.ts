import { Effect } from "effect";
import { CairoCustomEnum, CairoOption, CairoOptionVariant } from "starknet";
import { beforeEach, expect, it, vi } from "vitest";
import { ResourcesIds, RESOURCE_PRECISION } from "@bibliothecadao/types";
import { createHeraldRequestHandler } from "./http";
import { LiveWorld } from "./live-world";
import type { MadaraRpc } from "./madara-rpc";
import { receipt, rowEvent, rulesEvent, seedDerivedRows, setup, shardManifest } from "./native/fixtures";
import { frontierSettlementEvidence, sweepFrontierLords } from "../../value-relay/src/frontier-sweep";
import { shardConservationPort } from "../../value-relay/src/shard-conservation";

/** Only the L2 ledger and the shard's RPC are stood in for: every season fact comes from Herald's real snapshot route. */
const season = vi.hoisted(() => ({ start: 1_800_000_000, end: 1_800_000_000 + 4 * 14_400 }));
const calls = vi.hoisted(() => ({ admin: vi.fn(), funding: vi.fn(), settle: vi.fn() }));
vi.mock("@realms-world/value-ledger", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger")>()),
  rpcAt: vi.fn(),
  readFrontierFunding: calls.funding,
  readConfirmedLedgerHead: async () => ({ number: 10, time: season.end }),
}));
vi.mock("@realms-world/value-ledger/shard", () => ({
  ShardOperator: class {
    admin = calls.admin;
  },
}));
vi.mock("../../value-relay/src/shard-rpc", async (original) => ({
  ...(await original<typeof import("../../value-relay/src/shard-rpc")>()),
  ShardReader: class {
    header = async () => ({ timestamp: season.end });
  },
}));
vi.mock("../../value-relay/src/frontier-games", async (original) => ({
  ...(await original<typeof import("../../value-relay/src/frontier-games")>()),
  readFrontierGames: async () => ({ confirmedBlock: 10, games: [{ game_id: 1, clock: { end_at: season.end } }] }),
}));

const heraldUrl = "https://herald.test";
const shard = { chainId: "0x1", rpcUrl: "https://shard.test", gamesAddress: "0x10", firstRelease: 1 };
const ledger = { rpcUrl: "https://ledger.test", address: "0x30" };
const winner = 0xan;
const realm = "5";
const wei = (lords: number) => String(BigInt(lords) * 10n ** 18n);
const lords = (amount: number) => ({ balance: BigInt(amount) * BigInt(RESOURCE_PRECISION) });

/**
 * An ended Frontier season with daily expeditions: 700 LORDS of chests (40 opened into one realm) and a 300 prize the
 * relay awarded to the realm's owner, served by a Herald whose confirmed head is past the end.
 */
async function endedSeason() {
  const { native, decoder, fold } = setup();
  const apply = (events: ReturnType<typeof rowEvent>[]) =>
    native.applyReceipt(fold, receipt(seedDerivedRows(fold, decoder, events)), 9, 0);
  apply([
    rulesEvent("1", "14400"),
    rowEvent("GameRegistry", ["1"], {
      name: "1",
      preset_id: "6",
      settled: false,
      ready: true,
      dev_mode_on: false,
      start_settling_at: String(season.start),
      start_main_at: String(season.start),
      end_at: String(season.end),
      end_grace_seconds: "0",
      seed: "7",
    }),
    rowEvent("SettlementRules", ["1"], {
      registration_start: 0n,
      registration_limit: 0n,
      mode: new CairoCustomEnum({ Single: {} }),
      spacing: 100n,
    }),
    rowEvent("ChestRules", ["1"], {
      price_ceiling: 50n,
      shares: { common: 1n, uncommon: 2n, rare: 4n, epic: 10n, legendary: 20n },
      claim_window_seconds: 604800n,
      pool_bps: 7000,
      top_n: 3,
    }),
    rowEvent("LordsBudget", ["1"], {
      pool: 700n,
      pool_left: 660n,
      open: 0n,
      day: 3n,
      price: 50n,
      rolled_shares: 0n,
      yesterday_shares: 0n,
      yesterday_ticks: 0n,
    }),
    rowEvent("FrontierPrize", ["1"], { pool: 300n, issued: 300n, count: new CairoOption(CairoOptionVariant.Some, 1) }),
    rowEvent("LordsWithdrawal", ["1", "0x101"], { account: winner, amount: 300n, prize_rank: 1, prize_count: 1 }),
    rowEvent("ResourceBalance", ["1", realm, String(ResourcesIds.Lords)], lords(40)),
  ]);
  const head = { block_number: 10, timestamp: season.end, transactions: [] };
  const live = new LiveWorld({
    native,
    registry: decoder.registry,
    chain: "madara",
    checkpointEveryBlocks: 100,
    checkpointStore: { save: async () => undefined },
    confirmedBlock: 9,
    confirmedFold: fold,
    rpc: {
      getBlockHeader: async () => head,
      getPreconfirmedHeader: async () => ({ ...head, block_number: 11 }),
      readBlock: async () => head,
    } as unknown as MadaraRpc,
  });
  await live.acceptSubscribedHead(head);
  const handler = createHeraldRequestHandler({
    chain: "madara",
    manifest: shardManifest,
    schemas: {},
    worldAddress: shard.gamesAddress,
    confirmedBlock: () => live.confirmedBlock,
    chainTimestamp: () => live.chainTimestamp,
    confirmedTimestamp: () => live.chainTimestamp,
    decodedModelCount: 0,
    fold: {
      modelRows: (model) => live.modelRows(model),
      structurePosition: (game, entity) => live.structurePosition(game, entity),
      expeditionSite: (game, entity) => live.expeditionSite(game, entity),
      directoryRevision: () => live.directoryRevision(),
      snapshot: (gameId, _confirmedBlock, models, actor, owner) => live.snapshot(gameId, models, actor, owner),
    },
    undecodableEventCount: () => 0,
    nodeHealth: () => null,
  });
  // The shard's sweep: the realm's LORDS leave it as a chest receipt in the same transaction.
  const sweep = () =>
    apply([
      rowEvent("ResourceBalance", ["1", realm, String(ResourcesIds.Lords)], lords(0)),
      rowEvent("LordsWithdrawal", ["1", "0x102"], { account: winner, amount: 40n, prize_rank: 0, prize_count: 0 }),
    ]);
  const network = ((url: string | URL | Request) => handler(new Request(String(url)))) as typeof fetch;
  return { network, sweep };
}

const funding = (chestPaid: number) => ({
  claimDeadline: season.end + 604800,
  closed: false,
  pool: wei(700),
  prizePool: wei(300),
  paid: wei(chestPaid),
  prizePaid: wei(300),
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

it("sweeps the season's realm LORDS and settles it once every receipt is paid, from Herald's snapshot", async () => {
  const herald = await endedSeason();
  vi.stubGlobal("fetch", herald.network);
  calls.admin.mockImplementation(async () => herald.sweep());
  calls.funding.mockResolvedValue(funding(0));
  const tick = () =>
    sweepFrontierLords({ ...shard, accountAddress: "0x20", privateKey: "0x1" }, heraldUrl, ledger, calls.settle);

  await tick();
  expect(calls.admin.mock.calls).toEqual([["sweep_lords", { game_id: 1, structure_id: realm }]]);
  expect(calls.settle).not.toHaveBeenCalled();

  // The relay pays the sweep's receipt on L2; the next tick closes the season with the exact paid totals.
  calls.funding.mockResolvedValue(funding(40));
  await tick();
  const settlement = { chainId: shard.chainId, gameId: 1, chestWithdrawn: wei(40), prizeWithdrawn: wei(300) };
  expect(calls.settle.mock.calls).toEqual([[settlement]]);
  expect(calls.admin).toHaveBeenCalledTimes(1);

  // The co-signer accepts that settlement and its 660-LORDS treasury return from the same confirmed facts.
  expect(await frontierSettlementEvidence(shard, heraldUrl, settlement, ledger, wei(660))).toBeNull();

  // The monitor counts both receipts against what the season issued.
  const conservation = await Effect.runPromise(shardConservationPort(shard, heraldUrl, herald.network)());
  expect(conservation).toEqual([
    { chainId: shard.chainId, gameId: 1, confirmedBlock: 10, pool: "700", receipts: "340", netIssued: "340" },
  ]);
});
