import { slotValueFixture } from "./test-database";
import { Effect } from "effect";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LaunchExecutor, launchExecutorLayer } from "./executor";
import { slotResolver } from "./paid-blitz";
import { D1LaunchStore } from "./store";
import { createLaunchTestDatabase, DEV_CHAIN, PRODUCTION_CHAIN, TEST_CHAIN, testChain } from "./test-database";

const native = vi.hoisted(() => ({
  launchBlitz: vi.fn(
    async (launches: readonly { request: { gameName: string }; players: readonly unknown[]; seater: string }[]) =>
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
        settlementTransactions: 1,
      })),
  ),
}));
vi.mock("./shard-client", () => ({
  LaunchShard: class {
    launchBlitz = native.launchBlitz;
  },
}));
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
    shard: async () => ({ url: "https://shard.test", chainId: listedChain }),
  },
  accountAddress: "0x1",
  privateKey: "unused-test-key",
  /** A pool of two seaters; joining it is a shard write, so a refused run must not reach it. */
  seaters: vi.fn(async () => ["0x5a", "0x5b"]),
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
    }).pipe(Effect.provide(launchExecutorLayer(layerTarget, slotResolver(value, layerTarget.directory)))),
  );
it("launches a whole slot from whichever game run it picked, resolving the slot once and completing every game", async () => {
  const store = new D1LaunchStore(database.db, testChain());
  const queue = (groupIndex: number) =>
    store.schedule({
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
  // Groups are dealt to the seater pool round-robin by group index.
  expect(launches.map(({ request, players, seater }) => [request.gameName, players.length, seater])).toEqual([
    ["blitz-1100-1", 13, "0x5a"],
    ["blitz-1100-2", 12, "0x5b"],
  ]);
  expect(summary).toMatchObject({ gameName: "blitz-1100-1", gameId: 7 });
  expect(await store.find("madara.blitz", sibling.name)).toMatchObject({
    status: "complete",
    summary: { gameId: 8, settlementTransactions: 1 },
  });
  // The retry of an interrupted run launches the same slot again; the completed sibling is left as it is.
  await executeRun(picked, store, distinct, value);
  expect(native.launchBlitz).toHaveBeenCalledTimes(2);
  expect(await store.find("madara.blitz", sibling.name)).toMatchObject({ status: "complete" });
});

it("refuses a slot game queued for a dev chain when the bound shard now answers as another chain", async () => {
  listedChain = DEV_CHAIN;
  manifestChain = PRODUCTION_CHAIN;
  const run = await new D1LaunchStore(database.db, testChain(DEV_CHAIN)).schedule({
    environment: "madara.blitz",
    gameName: "blitz-1100-1",
    slotId: 12,
    groupIndex: 0,
  });
  await expect(executeRun(run, new D1LaunchStore(database.db, testChain(DEV_CHAIN)))).rejects.toMatchObject({
    cause: new Error("directory_manifest_chain_differs"),
  });
  expect(native.launchBlitz).not.toHaveBeenCalled();
  expect(target.seaters).not.toHaveBeenCalled();
});
