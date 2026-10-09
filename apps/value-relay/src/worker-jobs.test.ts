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
vi.mock("@realms-world/value-ledger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@realms-world/value-ledger")>()),
  rpcAt: () => ({ getChainId: async () => "0x1" }),
}));
const finish = vi.hoisted(() => vi.fn());
vi.mock("./chests", () => ({ DurableChestStore: class {}, finishRequestedChests: finish }));
it("runs and publishes the chest job even while shard ingestion remains unavailable", async () => {
  const data = new Map<string, unknown>();
  const ctx = {
    blockConcurrencyWhile: async (run: () => Promise<unknown>) => run(),
    storage: {
      setAlarm: async () => {},
      get: async (key: string) => data.get(key),
      list: async () => new Map(),
      put: async (key: string, value: unknown) => {
        data.set(key, value);
      },
    },
  };
  finish.mockReturnValue(Effect.succeed({ finished: 1, failed: 0, pending: 0 }));
  const relay = new ValueRelay(
    ctx as unknown as DurableObjectState,
    { SHARD_CHAIN_ID: "0x1", IDENTITY: { l2ChainId: async () => "0x1" } } as never,
  );
  const observation = await relay.tick();
  expect(observation.value.status).toBe("unavailable");
  expect(observation.chests).toEqual({ finished: 1, failed: 0, pending: 0 });
  expect(finish).toHaveBeenCalledOnce();
  expect((await relay.health()).success).toBe(false);
  expect(data.has("lastTick")).toBe(true);
});

it("reconciles identity links on its startup alarm independently of unavailable shard reads", async () => {
  const data = new Map<string, unknown>();
  const targets = vi.fn(async () => ({ rows: [], next: null }));
  const alarm = vi.fn(async () => {});
  const ctx = {
    blockConcurrencyWhile: async (run: () => Promise<unknown>) => run(),
    storage: {
      setAlarm: alarm,
      get: async (key: string) => data.get(key),
      list: async () => new Map(),
      put: async (key: string, value: unknown) => {
        data.set(key, value);
      },
    },
  };
  finish.mockReturnValue(Effect.succeed({ finished: 0, failed: 0, pending: 0 }));
  const relay = new ValueRelay(
    ctx as unknown as DurableObjectState,
    { SHARD_CHAIN_ID: "0x1", IDENTITY: { l2ChainId: async () => "0x1", accountLinkTargets: targets } } as never,
  );
  expect(alarm).toHaveBeenCalledWith(expect.any(Number));
  await relay.alarm();
  expect(targets).toHaveBeenCalledWith(null);
  expect((data.get("lastTick") as { links: unknown }).links).toEqual({ checked: 0, pending: [] });
});
