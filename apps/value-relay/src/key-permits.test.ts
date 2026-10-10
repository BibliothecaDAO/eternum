import { Effect } from "effect";
import { expect, it, vi } from "vitest";
import { ValueRelay } from "./worker";
vi.mock("cloudflare:workers", () => ({
  WorkerEntrypoint: class {},
  DurableObject: class {
    constructor(
      public ctx: unknown,
      public env: unknown,
    ) {}
  },
}));
vi.mock("@realms-world/value-ledger", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger")>()),
  readRegisteredShard: async () => ({
    chainId: "0x1",
    rpcUrl: "https://proxy.test/rpc/v0_10_2",
    contracts: { games: "0x77" },
    url: "https://shard.test",
    status: "active",
  }),
  rpcAt: () => ({ getChainId: async () => "0x1" }),
}));
vi.mock("./game-entry", () => ({ paidGameEntry: () => Effect.succeed({ kind: "free" }) }));
const blocked = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("./blitz-launch", () => ({ openBlitzOnLedger: blocked.run }));
vi.mock("./shard-labor", () => ({ currentLaborDay: () => Effect.succeed(1) }));
vi.mock("./relay", () => ({ grantDailyLabor: () => Effect.succeed({ amount: "1" }) }));
it("lets the shard signer grant labor while the ledger signer awaits confirmation", async () => {
  let release!: () => void, started!: () => void;
  const holding = new Promise<void>((resolve) => {
    release = resolve;
  });
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  blocked.run.mockImplementation(() =>
    Effect.promise(async () => {
      started();
      await holding;
    }),
  );
  const storage = { setAlarm: async () => {}, get: async () => undefined };
  const relay = new ValueRelay(
    { storage, blockConcurrencyWhile: async (run: () => Promise<unknown>) => run() } as unknown as DurableObjectState,
    {
      IDENTITY: {
        l2ChainId: async () => "0x1",
        shards: async () => [{ chainId: "0x1", url: "https://shard.test", status: "active" }],
      },
    } as never,
  );
  const opening = relay.openBlitz({ chainId: "0x1", gameId: 1 }, { start: 1, end: 2 });
  await entered;
  const labor = relay.labor({
    chainId: "0x1",
    gameId: 1,
    realmId: "1",
    home: "1",
    day: 1,
    realmsId: "0x1",
    account: "0x2",
  });
  const granted = await Promise.race([
    labor.then(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 50)),
  ]);
  release();
  await Promise.all([opening, labor]);
  expect(granted).toBe(true);
});
