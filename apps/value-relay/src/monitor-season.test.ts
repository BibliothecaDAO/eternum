vi.mock("./environment", async (original) => ({
  ...(await original<typeof import("./environment")>()),
  ledgerAddress: () => "0x10",
}));
import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { ValueMonitor } from "./monitor-worker";

const calls = vi.hoisted(() => ({
  pause: vi.fn(),
  balance: vi.fn(),
  season: vi.fn(),
}));
vi.mock("cloudflare:workers", () => ({
  WorkerEntrypoint: class {},
  DurableObject: class {
    constructor(
      public ctx: unknown,
      public env: unknown,
    ) {}
  },
}));
vi.mock("./ledger-chain", () => ({
  onIdentityChain: (_url: unknown, _identity: unknown, operation: unknown) => operation,
}));
vi.mock("./season-tops", () => ({ processSeasonTops: calls.season }));
vi.mock("./monitor-balance", () => ({ readMonitorFeeBalance: calls.balance }));
vi.mock("./chain", () => ({ ledgerPauserAdapter: () => calls.pause }));
vi.mock("./ledger", () => ({
  ledgerMonitorReads: () => ({
    reportedClaims: () =>
      Effect.succeed({
        rows: [],
        next: null,
        head: 0,
        anchor: { number: 0, hash: "0x1" },
        rewind: false,
        fromBlock: 0,
      }),
    postedResults: () =>
      Effect.succeed({ rows: [], head: 1, anchor: { number: 1, hash: "0xa" }, rewind: false, next: null }),
    paidClaims: () =>
      Effect.succeed({ rows: [], head: 1, anchor: { number: 1, hash: "0xa" }, rewind: false, next: null }),
  }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  calls.pause.mockReturnValue(Effect.void);
  calls.balance.mockResolvedValue({
    account: "0x9",
    token: "0x10",
    balance_wei: "1000000000000000000",
    low_balance_threshold_wei: "100000000000000000",
    warning: null,
    block_number: 10,
  });
});
const monitor = () => {
  const data = new Map<string, unknown>();
  return new ValueMonitor(
    {
      storage: {
        get: async (key: string) => data.get(key),
        put: async (key: string, value: unknown) => {
          data.set(key, value);
        },
      },
    } as unknown as DurableObjectState,
    {
      L2_RPC_URL: "https://ledger.test",
      PAUSER_ACCOUNT_ADDRESS: "0x9",
      ENVIRONMENT: "staging",
      IDENTITY: { l2ChainId: async () => "0x1", shard: async () => null },
      RELAY_REPORT: { held: async () => [] },
    } as never,
  );
};
it("keeps Frontier payouts running after the independent season check challenges a list", async () => {
  calls.season.mockReturnValue(Effect.succeed("season_challenged:7"));
  const worker = monitor();
  expect(await worker.tick()).toMatchObject({ season_error: "season_challenged:7", value: { halted: null } });
  expect(calls.pause).not.toHaveBeenCalled();
});
it("reports season read failure without routing it to the global payout pause", async () => {
  calls.season.mockReturnValue(Effect.fail({ operation: "season_audit" }));
  const worker = monitor();
  for (let pass = 0; pass < 4; pass++)
    expect(await worker.tick()).toMatchObject({ season_error: "audit season leaderboard", value: { halted: null } });
  expect((await worker.health()).success).toBe(false);
  expect(calls.pause).not.toHaveBeenCalled();
});

it("reports pending season checks as red health without pausing value", async () => {
  const worker = monitor();
  for (const status of ["season_history_pending", "season_review_pending:2"]) {
    calls.season.mockReturnValue(Effect.succeed(status));
    await worker.tick();
    expect(await worker.health()).toMatchObject({ success: false, season_error: status });
  }
  calls.season.mockReturnValue(Effect.succeed(null));
  await worker.tick();
  expect((await worker.health()).success).toBe(true);
  expect(calls.pause).not.toHaveBeenCalled();
});

it("publishes a low STRK warning from the first tick without pausing, and clears it after replenishment", async () => {
  calls.season.mockReturnValue(Effect.succeed(null));
  calls.balance.mockResolvedValueOnce({
    account: "0x9",
    token: "0x10",
    balance_wei: "0",
    low_balance_threshold_wei: "100000000000000000",
    warning: "monitor_strk_low",
    block_number: 10,
  });
  const worker = monitor();
  await worker.tick();
  expect(await worker.health()).toMatchObject({
    success: false,
    fee_balance: { account: "0x9", balance_wei: "0", warning: "monitor_strk_low" },
    fee_balance_error: null,
  });
  expect(calls.balance).toHaveBeenCalledWith("https://ledger.test", "0x9");
  expect(calls.pause).not.toHaveBeenCalled();
  await worker.tick();
  expect(await worker.health()).toMatchObject({ success: true, fee_balance: { warning: null } });
});

it("reports an unavailable balance as unknown instead of serving a stale healthy balance", async () => {
  calls.season.mockReturnValue(Effect.succeed(null));
  const worker = monitor();
  await worker.tick();
  calls.balance.mockRejectedValueOnce(new Error("RPC unavailable"));
  await worker.tick();
  expect(await worker.health()).toMatchObject({
    success: false,
    fee_balance: null,
    fee_balance_error: "monitor STRK balance unavailable",
  });
  expect(calls.pause).not.toHaveBeenCalled();
});
