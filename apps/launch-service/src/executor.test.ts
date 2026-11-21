import { Effect } from "effect";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LaunchExecutor, launchExecutorLayer } from "./executor";
import { D1LaunchStore } from "./store";
import { createLaunchTestDatabase, DEV_CHAIN, PRODUCTION_CHAIN, testChain } from "./test-database";

const native = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("./shard-client", () => ({
  LaunchShard: class {
    create = native.create;
  },
}));
let database: Awaited<ReturnType<typeof createLaunchTestDatabase>>;
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        version: 1,
        chainId: PRODUCTION_CHAIN,
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
    shard: async () => ({ url: "https://shard.test", chainId: DEV_CHAIN }),
  },
  accountAddress: "0x1",
  privateKey: "unused-test-key",
};

it("refuses a game queued for a dev chain when the bound shard now answers as another chain", async () => {
  const store = new D1LaunchStore(database.db, testChain(DEV_CHAIN));
  const run = await store.schedule({ environment: "madara.blitz", gameName: "blitz-1100-1" });
  const execution = Effect.gen(function* () {
    const executor = yield* LaunchExecutor;
    return yield* executor.execute(run, store);
  }).pipe(Effect.provide(launchExecutorLayer(target)));
  await expect(Effect.runPromise(execution)).rejects.toMatchObject({
    cause: new Error("directory_manifest_chain_differs"),
  });
  expect(native.create).not.toHaveBeenCalled();
});
