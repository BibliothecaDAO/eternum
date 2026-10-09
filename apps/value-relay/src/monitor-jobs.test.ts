import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import worker, { ValueMonitor } from "./monitor-worker";

vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    constructor(
      public ctx: unknown,
      public env: unknown,
    ) {}
  },
}));
vi.mock("@realms-world/value-ledger", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger")>()),
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
      transaction: async (run: (tx: unknown) => Promise<unknown>): Promise<unknown> => run(ctx.storage),
      delete: async (key: string) => data.delete(key),
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

it("requires an operator token and a recorded reason to clear a monitor halt without losing cursors", async () => {
  const f = fixture();
  const progress = {
    halted: "paid_wallet_mismatch:0xabc",
    unverifiedTicks: 3,
    cursors: { paidClaims: { fromBlock: 11, page: null } },
  };
  f.data.set("progress", progress);
  const env = {
    OPERATOR_TOKEN: "operator-test-token",
    MONITOR: { idFromName: () => "monitor", get: () => f.monitor },
  } as never;
  const request = (reason: string, token = "operator-test-token") =>
    new Request("https://monitor.test/api/operator/monitor/reset", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    });
  expect((await worker.fetch(request("Investigated", "wrong-token"), env)).status).toBe(401);
  expect((await worker.fetch(request(""), env)).status).toBe(400);
  expect((await worker.fetch(request("Receipt RPC corrected; replay verified"), env)).status).toBe(200);
  expect(await f.monitor.status()).toMatchObject({ halted: null, unverifiedTicks: 0, cursors: progress.cursors });
  expect(f.data.get("reset:sequence")).toBe(1);
  expect(f.data.get("reset:1")).toMatchObject({ reason: "Receipt RPC corrected; replay verified", previous: progress });
});
