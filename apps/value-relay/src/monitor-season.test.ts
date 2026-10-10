import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { ValueMonitor } from "./monitor-worker";

const calls = vi.hoisted(() => ({ pause: vi.fn(), season: vi.fn() }));
vi.mock("cloudflare:workers", () => ({
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
vi.mock("./chain", () => ({ ledgerPauserAdapter: () => calls.pause }));
vi.mock("./ledger", () => ({
  ledgerMonitorReads: () => ({
    paidClaims: () => Effect.succeed({ rows: [], head: 1, next: null }),
    postedResults: () => Effect.succeed({ rows: [], head: 1, next: null }),
  }),
}));
vi.mock("./chests", () => ({
  DurableChestStore: class {},
  overdueChestRequests: () => Effect.succeed({ pending: 0, overdue: [] }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  calls.pause.mockReturnValue(Effect.void);
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
      LEDGER_RPC_URL: "https://ledger.test",
      LEDGER_ADDRESS: "0x10",
      IDENTITY: { shards: async () => [] },
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
