const address = vi.hoisted(() => vi.fn(() => "0x10"));
vi.mock("./environment", async (original) => ({
  ...(await original<typeof import("./environment")>()),
  ledgerAddress: address,
}));
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import worker, { ValueMonitor } from "./monitor-worker";
import { runMonitor, type MonitorProgress } from "./monitor";
import type { MonitorPorts } from "./ports";

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
  rpcAt: () => ({
    getChainId: async () => "0x1",
    getBlock: async () => {
      throw new Error("unavailable_read");
    },
  }),
}));
const fixture = () => {
  const data = new Map<string, unknown>();
  const ctx = {
    storage: {
      transaction: async (run: (tx: unknown) => Promise<unknown>): Promise<unknown> => run(ctx.storage),
      list: async ({ prefix }: { prefix: string }) => new Map([...data].filter(([key]) => key.startsWith(prefix))),
      delete: async (keys: string | string[]) => {
        for (const key of typeof keys === "string" ? [keys] : keys) data.delete(key);
      },
      get: async (key: string) => data.get(key),
      put: async (key: string, value: unknown) => {
        data.set(key, value);
      },
    },
  };
  const monitor = new ValueMonitor(
    ctx as unknown as DurableObjectState,
    {
      L2_RPC_URL: "https://ledger.test",
      LAUNCH: { rosterCohorts: async () => [] },
      IDENTITY: { l2ChainId: async () => "0x1", shards: async () => [] },
    } as never,
  );
  return { monitor, data };
};
beforeEach(() => {
  vi.clearAllMocks();
  address.mockReturnValue("0x10");
});
it("reports a failed value read without a green health result", async () => {
  const f = fixture();
  expect((await f.monitor.health()).success).toBe(false);
  const observation = await f.monitor.tick();
  expect(observation.value).toBeNull();
  expect(observation.value_error).toBeTruthy();
  expect((await f.monitor.health()).success).toBe(false);
});
it("reports a fresh completed audit as healthy, and refuses stale or paused progress", async () => {
  const f = fixture();
  const checked_at = Math.floor(Date.now() / 1000);
  const observation = {
    checked_at,
    value: { halted: null },
    value_error: null,
    season_error: null,
  };
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
    fault: {
      row: "paidClaims:0x1:0xabc",
      stream: "paidClaims",
      cursor: { fromBlock: 11, page: JSON.stringify({ head: 20, token: "" }) },
      offset: 0,
    },
    cursors: { paidClaims: { fromBlock: 11, page: null } },
  };
  f.data.set("progress", progress);
  const env = {
    ENVIRONMENT: "staging",
    L2_RPC_URL: "https://ledger.test",
    PAUSER_ACCOUNT_ADDRESS: "0x1",
    PAUSER_PRIVATE_KEY: "0x2",
    OPERATOR_TOKEN: "operator-test-token",
    MONITOR: { idFromName: () => "monitor", get: () => f.monitor },
  } as never;
  const request = (reason: string, token = "operator-test-token") =>
    new Request("https://monitor.test/api/operator/monitor/reset", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ row: "paidClaims:0x1:0xabc", reason }),
    });
  expect((await worker.fetch(request("Investigated", "wrong-token"), env)).status).toBe(401);
  expect((await worker.fetch(request(""), env)).status).toBe(400);
  const answer = await worker.fetch(request("Receipt RPC corrected; replay verified"), env);
  expect(answer.status).toBe(200);
  // This fault, in the shape the previous version wrote, recorded no fact: the reset waives nothing and keeps the
  // cursor where the check stopped, so the row is checked again.
  expect(await answer.json()).toMatchObject({ halted: null, waived: null });
  const status = await f.monitor.status();
  expect(status).toMatchObject({ halted: null, fault: null, cursors: { paidClaims: { fromBlock: 11, page: null } } });
  expect(status.cleared).toBeUndefined();
  expect(f.data.get("reset:sequence")).toBe(1);
  expect(f.data.get("reset:1")).toMatchObject({
    reason: "Receipt RPC corrected; replay verified",
    previous: progress,
    waived: null,
  });
});

describe.each(["paidClaims", "postedResults"] as const)(
  "resetting a %s halt the previous version recorded",
  (stream) => {
    const row = stream === "paidClaims" ? "paidClaims:0x1:0xabc" : "postedResults:0x1:1";
    const ledger = {
      paid: [
        {
          chainId: "0x1",
          transactionHash: "0xabc",
          seasonId: 1,
          wallet: "0x123",
          amount: "1",
          paymentTransactionHash: "0xdef",
          paidAt: 1,
        },
      ],
      posted: [{ chainId: "0x1", gameId: 1, commitment: "0x2" }],
      anchor: "0xa",
    };
    const pause = vi.fn(() => Effect.void);
    const page = <A>(rows: A[]) =>
      Effect.succeed({ rows, head: 10, anchor: { number: 10, hash: ledger.anchor }, rewind: true, next: null });
    const ports: MonitorPorts = {
      // The check always disagrees: neither identity nor the shard matches the ledger.
      identity: { matchesPayDecision: () => Effect.succeed(false) },
      shard: {
        conservation: () => Effect.succeed([]),
        withdrawal: (chainId, transactionHash) =>
          Effect.succeed({ chainId, transactionHash, seasonId: 1, amount: "1", realmsId: "0x2", confirmedAt: 1 }),
        result: (chainId, gameId) => Effect.succeed({ chainId, gameId, commitment: "0x1", rows: [] }),
      },
      ledger: {
        frontierPool: () => Effect.succeed("0"),
        paidClaims: () => page(stream === "paidClaims" ? ledger.paid : []),
        postedResults: () => page(stream === "postedResults" ? ledger.posted : []),
        pause,
      },
    };
    /** The Durable Object's progress, read and written only through JSON, as storage keeps it. */
    const persisted = (data: Map<string, unknown>) => ({
      load: async (): Promise<MonitorProgress> => JSON.parse(JSON.stringify(data.get("progress"))),
      save: async (next: MonitorProgress) => {
        data.set("progress", JSON.parse(JSON.stringify(next)));
      },
    });

    it("waives nothing, re-observes the row, and makes the next reset durable", async () => {
      const f = fixture();
      f.data.set("progress", {
        halted: stream === "paidClaims" ? "paid_wallet_mismatch:0xabc" : "blitz_result_mismatch:1",
        fault: { row, stream, cursor: { fromBlock: 0, page: null }, offset: 0 },
      });
      expect(await f.monitor.reset(row, "Investigated")).toMatchObject({ halted: null, waived: null });
      pause.mockClear();
      // The unchanged row is checked again and halts again, this time recording what it saw.
      await Effect.runPromise(runMonitor(ports, persisted(f.data)));
      expect(pause).toHaveBeenCalledOnce();
      const fact = (await f.monitor.status()).fault?.fact;
      expect(fact).toMatch(new RegExp(`^${stream}:`));
      expect(await f.monitor.reset(row, "Investigated again")).toMatchObject({ halted: null, waived: fact });
      // That clearance is durable: an unchanged replay at a new anchor stays cleared...
      ledger.anchor = "0xb";
      pause.mockClear();
      await Effect.runPromise(runMonitor(ports, persisted(f.data)));
      expect(pause).not.toHaveBeenCalled();
      // ...and a rewritten row on the same claim or game is checked again and pauses.
      if (stream === "paidClaims") ledger.paid = [{ ...ledger.paid[0]!, amount: "2", wallet: "0x999" }];
      else ledger.posted = [{ ...ledger.posted[0]!, commitment: "0x3" }];
      ledger.anchor = "0xc";
      await Effect.runPromise(runMonitor(ports, persisted(f.data)));
      expect(pause).toHaveBeenCalledOnce();
      expect((await f.monitor.status()).halted).toMatch(/mismatch/);
    });
  },
);

it("records the missing ledger after running shard conservation", async () => {
  address.mockImplementation(() => {
    throw new Error("ledger not deployed");
  });
  const f = fixture();
  for (let tick = 0; tick < 5; tick++) {
    const observation = await f.monitor.tick();
    expect(observation).toMatchObject({ value: null, value_error: "ledger paid claims unavailable" });
    expect(f.data.get("progress")).toBeUndefined();
    expect(f.data.get("observation")).toEqual(observation);
  }
  expect((await f.monitor.health()).success).toBe(false);
});
