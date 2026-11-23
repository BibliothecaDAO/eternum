vi.mock("./environment", async (original) => ({
  ...(await original<typeof import("./environment")>()),
  ledgerAddress: () => "0x10",
  ledgerContractOf: () => ({ contractAddress: "0x10", deploymentBlock: 1 }),
}));
import { Effect } from "effect";
import { expect, it, vi } from "vitest";
import { ValueRelay } from "./worker";
import { releaseLine } from "../../../packages/core/src/test-support/releases";
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
    releases: releaseLine("0xs", [1]),
    url: "https://shard.test",
  }),
  rpcAt: () => ({ getChainId: async () => "0x1" }),
}));
const blocked = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("./blitz-launch", () => ({ refundSlotOnLedger: blocked.run }));
vi.mock("./realm-entry", async (original) => ({
  ...(await original<typeof import("./realm-entry")>()),
  registerHomeSource: async () => ({ realmId: 1 }),
}));
it("lets the shard signer register a home source while the ledger signer awaits confirmation", async () => {
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
        shard: async () => ({ chainId: "0x1", url: "https://shard.test" }),
      },
    } as never,
  );
  const refunding = relay.refundSlot({ chainId: "0x1", slotId: 1 });
  await entered;
  const entry = relay.realmEntry({ chainId: "0x1", gameId: 1, realmId: 1, realmsId: "0x1", account: "0x2" });
  const registered = await Promise.race([
    entry.then(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 50)),
  ]);
  release();
  await Promise.all([refunding, entry]);
  expect(registered).toBe(true);
});
