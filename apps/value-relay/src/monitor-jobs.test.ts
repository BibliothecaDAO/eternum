import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { ValueMonitor } from "./monitor-worker";

vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    constructor(
      public ctx: unknown,
      public env: unknown,
    ) {}
  },
}));
vi.mock("./rpc", () => ({
  rpcAt: () => {
    throw new Error("unavailable_read");
  },
}));
const overdue = vi.hoisted(() => vi.fn());
vi.mock("./chests", () => ({ DurableChestStore: class {}, overdueChestRequests: overdue }));
const fixture = () => {
  const data = new Map<string, unknown>();
  const ctx = {
    storage: {
      get: async (key: string) => data.get(key),
      put: async (key: string, value: unknown) => {
        data.set(key, value);
      },
    },
  };
  const monitor = new ValueMonitor(
    ctx as unknown as DurableObjectState,
    { SHARD_CHAIN_ID: "0x1", LEDGER_RPC_URL: "https://ledger.test" } as never,
  );
  return { monitor, data };
};
beforeEach(() => {
  vi.clearAllMocks();
  overdue.mockReturnValue(Effect.succeed({ overdue: ["7"], pending: 1 }));
});
it("publishes chest warnings and a failed value read independently, without a green health result", async () => {
  const f = fixture();
  expect((await f.monitor.health()).success).toBe(false);
  const observation = await f.monitor.tick();
  expect(observation.value).toBeNull();
  expect(observation.value_error).toBeTruthy();
  expect(observation.chests).toEqual({ overdue: ["7"], pending: 1 });
  expect(overdue).toHaveBeenCalledOnce();
  expect((await f.monitor.health()).success).toBe(false);
});
it("reports a fresh completed audit as healthy, and refuses stale or paused progress", async () => {
  const f = fixture();
  const checked_at = Math.floor(Date.now() / 1000);
  const observation = { checked_at, value: { halted: null }, value_error: null, chests: { overdue: [], pending: 0 } };
  f.data.set("observation", observation);
  expect((await f.monitor.health()).success).toBe(true);
  f.data.set("progress", { halted: "lords_conservation:7:10" });
  expect((await f.monitor.health()).success).toBe(false);
  f.data.set("progress", { halted: null });
  f.data.set("observation", { ...observation, checked_at: checked_at - 301 });
  expect((await f.monitor.health()).success).toBe(false);
});
