import { slotValueFixture } from "./test-database";
import { Effect } from "effect";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LaunchExecutor, launchExecutorLayer } from "./executor";
import { D1LaunchStore } from "./store";
import { createLaunchTestDatabase, TEST_CHAIN, testChain } from "./test-database";

const native = vi.hoisted(() => ({
  create: vi.fn(async () => ({
    environment: "madara.blitz",
    chain: "madara",
    gameType: "blitz",
    gameName: "blitz-roster-test",
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
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        version: 1,
        chainId: "0x534e5f5445535f5348415244",
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
    accountAtRegistration: async () => "0x456",
    shards: async () => [{ url: "https://shard.test", chainId: TEST_CHAIN, status: "active" as const }],
  },
  accountAddress: "0x1",
  privateKey: "unused-test-key",
};
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
