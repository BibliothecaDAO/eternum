import { slotValueFixture } from "./test-database";
import { Effect } from "effect";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LaunchExecutor, launchExecutorLayer } from "./executor";
import { D1LaunchStore } from "./store";
import { testBlitzRequest } from "./test-blitz";
import { createLaunchTestDatabase, DEV_CHAIN, PRODUCTION_CHAIN, TEST_CHAIN, testChain } from "./test-database";

const native = vi.hoisted(() => ({
  launchBlitz: vi.fn(async (launches: readonly { request: { gameName: string }; players: readonly unknown[] }[]) =>
    launches.map(({ request }, index) => ({
      environment: "madara.blitz",
      chain: "madara",
      gameType: "blitz",
      gameName: request.gameName,
      gameId: 7 + index,
      startTime: 100,
      durationSeconds: 60,
      startTimeIso: "1970-01-01T00:01:40.000Z",
      rpcUrl: "https://shard.test/rpc",
      configMode: "batched",
      configSteps: [],
      dryRun: false,
      finalizeAt: 160,
      settlementTransactions: 1,
    })),
  ),
}));
vi.mock("./shard-client", () => ({
  LaunchShard: class {
    launchBlitz = native.launchBlitz;
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
it("launches a whole slot from whichever game run it picked, resolving the slot once and completing every game", async () => {
  const store = new D1LaunchStore(database.db, testChain());
  const queue = (groupIndex: number) =>
    store.schedule("game", {
      environment: "madara.blitz",
      gameName: `blitz-1100-${groupIndex + 1}`,
      slotId: 12,
      groupIndex,
    });
  const picked = await queue(0);
  const sibling = await queue(1);
  const value = slotValueFixture(25);
  const registrations = vi.fn(value.registrations);
  const distinct = {
    ...target,
    directory: {
      ...target.directory,
      accountsAtRegistration: async (page: readonly { wallet: string }[]) =>
        page.map((_, index) => `0x${(0x300 + index).toString(16)}`),
    },
  };
  const summary = await executeRun(picked, store, distinct, { ...value, registrations });
  expect(registrations).toHaveBeenCalledOnce();
  expect(native.launchBlitz).toHaveBeenCalledOnce();
  const [launches] = native.launchBlitz.mock.calls[0]!;
  expect(launches.map(({ request, players }) => [request.gameName, players.length])).toEqual([
    ["blitz-1100-1", 13],
    ["blitz-1100-2", 12],
  ]);
  expect(summary).toMatchObject({ gameName: "blitz-1100-1", gameId: 7 });
  expect(await store.find("game", "madara.blitz", sibling.name)).toMatchObject({
    status: "complete",
    summary: { gameId: 8, settlementTransactions: 1 },
  });
  expect(await store.find("result", "madara.blitz", sibling.name)).toMatchObject({ status: "queued" });
  // The retry of an interrupted run launches the same slot again; the completed sibling is left as it is.
  await executeRun(picked, store, distinct, value);
  expect(native.launchBlitz).toHaveBeenCalledTimes(2);
  expect(await store.find("game", "madara.blitz", sibling.name)).toMatchObject({ status: "complete" });
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
  expect(native.launchBlitz).toHaveBeenCalledWith([
    {
      request: run.request,
      createdAt: Date.parse(run.createdAt),
      players: [
        { account: "0x456", wallet: "0x456" },
        { account: "0x789", wallet: "0x789" },
      ],
    },
  ]);
  expect(registrations).not.toHaveBeenCalled();
});
it("refuses a queued test game on a Worker whose bindings select a production shard, before any shard write", async () => {
  listedChain = manifestChain = PRODUCTION_CHAIN;
  const run = await queueTestGame(PRODUCTION_CHAIN);
  await expect(executeRun(run, new D1LaunchStore(database.db, testChain(PRODUCTION_CHAIN)))).rejects.toMatchObject({
    cause: new Error("test_blitz_dev_shard_only"),
  });
  expect(native.launchBlitz).not.toHaveBeenCalled();
});
it("refuses a test game queued for a dev chain when the bound shard now answers as another chain", async () => {
  listedChain = DEV_CHAIN;
  manifestChain = PRODUCTION_CHAIN;
  const run = await queueTestGame(DEV_CHAIN);
  await expect(executeRun(run, new D1LaunchStore(database.db, testChain(DEV_CHAIN)))).rejects.toMatchObject({
    cause: new Error("directory_manifest_chain_differs"),
  });
  expect(native.launchBlitz).not.toHaveBeenCalled();
});
