import { slotValueFixture } from "./test-database";
import { Effect } from "effect";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LaunchExecutor, launchExecutorLayer } from "./executor";
import { D1LaunchStore } from "./store";
import { testBlitzRequest } from "./test-blitz";
import { createLaunchTestDatabase, DEV_CHAIN, PRODUCTION_CHAIN, TEST_CHAIN, testChain } from "./test-database";

const native = vi.hoisted(() => ({
  create: vi.fn(async (request: { gameName: string }, ..._rest: unknown[]) => ({
    environment: "madara.blitz",
    chain: "madara",
    gameType: "blitz",
    gameName: request.gameName,
    gameId: 7,
    startTime: 100,
    durationSeconds: 60,
    startTimeIso: "1970-01-01T00:01:40.000Z",
    rpcUrl: "https://shard.test/rpc",
    configMode: "batched",
    configSteps: [],
    dryRun: false,
  })),
  seat: vi.fn(async () => 1),
}));
vi.mock("./shard-client", () => ({
  LaunchShard: class {
    create = native.create;
    seat = native.seat;
    roster = async () => [];
    game = async () => ({ start_main_at: 100n, end_at: 160n });
  },
}));
vi.mock("./results", () => ({ finalizeGame: vi.fn() }));
let database: Awaited<ReturnType<typeof createLaunchTestDatabase>>;
/** The chain the bound identity lists, and the chain its shard's manifest answers. */
let listedChain = TEST_CHAIN;
let manifestChain = TEST_CHAIN;
beforeEach(async () => {
  vi.clearAllMocks();
  listedChain = manifestChain = TEST_CHAIN;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        version: 1,
        chainId: manifestChain,
        rpcUrl: "https://shard.test/rpc",
        accountClassHash: "0x2",
        guardianPublicKey: "0x9",
        contracts: { games: "0x77" },
      }),
    ),
  );
  database = await createLaunchTestDatabase();
});
afterEach(async () => {
  await database.close();
  vi.unstubAllGlobals();
});
const target = {
  directory: {
    accountsAtRegistration: async (page: readonly { wallet: string }[]) => page.map(() => "0x456"),
    shards: async () => [{ url: "https://shard.test", chainId: listedChain, status: "active" as const }],
  },
  accountAddress: "0x1",
  privateKey: "unused-test-key",
};
const executeRun = (
  run: import("./model").LaunchRun,
  store: D1LaunchStore,
  layerTarget = target,
  value = slotValueFixture(1),
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const executor = yield* LaunchExecutor;
      return yield* executor.execute(run, store);
    }).pipe(Effect.provide(launchExecutorLayer(layerTarget, value))),
  );
it("creates each paid game with its resolved historical cohort on every retry", async () => {
  const store = new D1LaunchStore(database.db, testChain());
  const run = await store.enqueue("game", {
    environment: "madara.blitz",
    gameName: "blitz-roster-test",
    slotId: 12,
    groupIndex: 0,
  });
  const value = slotValueFixture(1);
  const roster = vi.fn(value.registrations);
  const layer = launchExecutorLayer(target, { ...value, registrations: roster });
  const execute = () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const executor = yield* LaunchExecutor;
        return yield* executor.execute(run, store);
      }).pipe(Effect.provide(layer)),
    );
  await execute();
  await execute();
  expect(run.chainId).toBe(TEST_CHAIN);
  expect(native.create).toHaveBeenCalledWith(run.request, Date.parse(run.createdAt), undefined, [
    { wallet: "0x1", account: "0x456" },
  ]);
  expect(roster).toHaveBeenCalledTimes(2);
});

const queueTestGame = (chain: string) =>
  new D1LaunchStore(database.db, testChain(chain)).enqueue(
    "game",
    testBlitzRequest({ name: "test-hud", players: ["0x456", "0x789"] }, Date.now()),
  );
it("creates a test game on a dev shard with the named accounts as its roster, reading no ledger slot", async () => {
  listedChain = manifestChain = DEV_CHAIN;
  const run = await queueTestGame(DEV_CHAIN);
  const registrations = vi.fn();
  await executeRun(run, new D1LaunchStore(database.db, testChain(DEV_CHAIN)), target, {
    ...slotValueFixture(1),
    registrations,
  });
  expect(native.create).toHaveBeenCalledWith(run.request, Date.parse(run.createdAt), undefined, [
    { account: "0x456", wallet: "0x456" },
    { account: "0x789", wallet: "0x789" },
  ]);
  expect(native.seat).toHaveBeenCalledOnce();
  expect(registrations).not.toHaveBeenCalled();
});
it("refuses a queued test game on a Worker whose bindings select a production shard, before any shard write", async () => {
  listedChain = manifestChain = PRODUCTION_CHAIN;
  const run = await queueTestGame(PRODUCTION_CHAIN);
  await expect(executeRun(run, new D1LaunchStore(database.db, testChain(PRODUCTION_CHAIN)))).rejects.toMatchObject({
    cause: new Error("test_blitz_dev_shard_only"),
  });
  expect(native.create).not.toHaveBeenCalled();
});
it("refuses a test game queued for a dev chain when the bound shard now answers as another chain", async () => {
  listedChain = DEV_CHAIN;
  manifestChain = PRODUCTION_CHAIN;
  const run = await queueTestGame(DEV_CHAIN);
  await expect(executeRun(run, new D1LaunchStore(database.db, testChain(DEV_CHAIN)))).rejects.toMatchObject({
    cause: new Error("directory_manifest_chain_differs"),
  });
  expect(native.create).not.toHaveBeenCalled();
});
