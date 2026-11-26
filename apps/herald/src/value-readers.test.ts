import { CairoOption, CairoOptionVariant } from "starknet";
import { beforeEach, expect, it, vi } from "vitest";
import { createHeraldRequestHandler } from "./http";
import { LiveWorld } from "./live-world";
import type { MadaraRpc } from "./madara-rpc";
import { NativeDecoder } from "./native/decoder";
import { gameRegistryEvent, manifest, receipt, rowEvent, schema, shardManifest } from "./native/fixtures";
import { NativeIngestion } from "./native/ingestion";
import { RELEASE_DEFINITIONS, releaseDefinition } from "./native/release-definition";
import { NATIVE_RELEASES } from "../../../deploy/release/native-release";
import type { DecodedRecord } from "./types";
import { WorldFold } from "./world-fold";
import { releaseLine } from "../../../packages/core/src/test-support/releases";
import { memoryFinalFacts } from "../../value-relay/src/final-facts";
import { settleEndedFrontierGames } from "../../value-relay/src/frontier-end";
import { settleFinishedRaces } from "../../value-relay/src/race-rewards";
import { runShardJobs } from "../../value-relay/src/shard-jobs";

const shardNode = vi.hoisted(() => ({ time: 0, settleGame: vi.fn() }));
vi.mock("../../../packages/value-ledger/src/rpc", async (original) => ({
  ...(await original<typeof import("../../../packages/value-ledger/src/rpc")>()),
  rpcAt: () => ({
    getChainId: async () => "0x1",
    getBlock: async (id: number | "latest") => ({
      block_number: id === "latest" ? 10 : id,
      block_hash: "0xa",
      parent_hash: "0x9",
      timestamp: shardNode.time,
      status: "ACCEPTED_ON_L2",
    }),
  }),
}));
vi.mock("@realms-world/value-ledger/shard", () => ({
  ShardOperator: class {
    settleGame = shardNode.settleGame;
  },
}));

const heraldUrl = "https://herald.test";
const target = {
  chainId: "0x1",
  rpcUrl: "https://shard.test",
  gamesAddress: "0x10",
  firstRelease: 1,
  accountAddress: "0x20",
  privateKey: "0x1",
};
const season = { start: 1_800_000_000, end: 1_800_000_000 + 4 * 14_400 };
const ledgerSettlesRace = vi.fn();

const release = NATIVE_RELEASES.frontier.release;
const definition = releaseDefinition(RELEASE_DEFINITIONS, release);

function seasonOneLaunch() {
  return [
    gameRegistryEvent({
      start_settling_at: String(season.start),
      start_main_at: String(season.start),
      scheduled_end_at: String(season.end),
      end_at: String(season.end),
    }),
    rowEvent("GameOverrides", ["1"], {
      registration_start: season.start,
      biome_climate: (definition.rules as DecodedRecord).biome_climate_config,
      map: new CairoOption(CairoOptionVariant.None),
      map_center_offset: 0,
    }),
    rowEvent("GameRelease", ["1"], { release_id: release, created_release_id: release }),
  ];
}

async function heraldServingSeasonOne(timestamp: number) {
  const decoder = new NativeDecoder({
    ...manifest,
    native: { ...manifest.native, releaseId: release, releases: releaseLine(schema.identity, [release]) },
  });
  const fold = new WorldFold(decoder.registry);
  const native = new NativeIngestion(decoder);
  native.applyReceipt(fold, receipt(seasonOneLaunch()), 9, 0);
  const head = { block_number: 10, timestamp, transactions: [] };
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
    chain: target.chainId,
    manifest: shardManifest,
    schemas: {},
    worldAddress: target.gamesAddress,
    confirmedBlock: () => live.confirmedBlock,
    chainTimestamp: () => live.chainTimestamp,
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
  return ((url: string | URL | Request) => handler(new Request(String(url)))) as typeof fetch;
}

async function servedRows(herald: typeof fetch, model: string) {
  const response = await herald(`${heraldUrl}/games/1/snapshot?models=${model}`);
  const snapshot = (await response.json()) as { models: { model: string; rows: unknown[] }[] };
  return snapshot.models.find((served) => served.model === model)!.rows;
}

const runTickJobs = () =>
  runShardJobs(
    {
      "settle ended games": () => settleEndedFrontierGames(target, heraldUrl),
      "pay race rewards": () => settleFinishedRaces(target, heraldUrl, memoryFinalFacts(), ledgerSettlesRace),
    },
    [],
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it.each([
  ["live", season.start + 3_600, []],
  ["ended", season.end, [[1]]],
])(
  "runs both shard jobs without a failure on a %s Season 1 game whose rules Herald derived from the release",
  async (_, timestamp, settledGames) => {
    shardNode.time = timestamp;
    const herald = await heraldServingSeasonOne(timestamp);
    vi.stubGlobal("fetch", herald);
    expect(await servedRows(herald, "RaceRules")).toHaveLength(1);
    expect(await servedRows(herald, "ChestRules")).toEqual([]);

    expect(await runTickJobs()).toEqual([]);
    expect(shardNode.settleGame.mock.calls).toEqual(settledGames);
    expect(ledgerSettlesRace).not.toHaveBeenCalled();
  },
);
