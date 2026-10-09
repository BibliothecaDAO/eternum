import { Effect } from "effect";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { D1BlitzRosterStore } from "./blitz-roster";
import { LaunchExecutor, launchExecutorLayer } from "./executor";
import { D1LaunchStore } from "./store";
import { createLaunchTestDatabase, TEST_CHAIN, testChain } from "./test-database";

const launch = vi.hoisted(() => vi.fn(async (_request: unknown, _store: unknown) => ({ gameId: 7 })));
vi.mock("../../../config/deployer/clean/launch/runner", () => ({ launchGame: launch }));
vi.mock("@bibliothecadao/eternum/shard", () => ({
  openShard: async () => ({
    chainId: "0x534e5f5445535f5348415244",
    url: "https://shard.test",
    rpcUrl: "https://shard.test/rpc",
    admissionUrl: "https://shard.test/admission",
  }),
}));
vi.mock("../../../config/deployer/clean/world/native/manifest", () => ({
  registrarWorldOf: () => ({ world: { address: "0x77" } }),
}));
vi.mock("./results", () => ({ finalizeGame: vi.fn() }));
let database: Awaited<ReturnType<typeof createLaunchTestDatabase>>;
beforeEach(async () => {
  vi.clearAllMocks();
  database = await createLaunchTestDatabase();
});
afterEach(async () => {
  await database.close();
});
const target = { shardUrl: "https://shard.test", accountAddress: "0x1", privateKey: "unused-test-key" };
it("replaces the launcher's supplied Blitz roster with the persisted ledger roster on every retry", async () => {
  const store = new D1LaunchStore(database.db, testChain());
  const run = await store.enqueue("game", {
    environment: "madara.blitz",
    gameName: "blitz-roster-test",
    rosterAccounts: ["0xbad"],
  });
  const source = {
    readClosed: vi.fn(() =>
      Effect.succeed({
        gameId: 7,
        blockNumber: 100,
        blockHash: "0xabc",
        registrations: [{ wallet: "0x123", account: "0x456" }],
      }),
    ),
  };
  const layer = launchExecutorLayer(target, source, new D1BlitzRosterStore(database.db));
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
  expect(launch.mock.calls[0]![0]).toMatchObject({ rosterAccounts: ["0x456"] });
  expect(source.readClosed).toHaveBeenCalledTimes(1);
});
