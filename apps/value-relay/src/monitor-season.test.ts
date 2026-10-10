vi.mock("./environment", () => ({ ledgerAddress: () => "0x10" }));
import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { ValueMonitor } from "./monitor-worker";

const calls = vi.hoisted(() => ({ pause: vi.fn(), season: vi.fn(), cohorts: vi.fn() }));
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
vi.mock("./chain", () => ({ ledgerPauserAdapter: () => calls.pause }));
vi.mock("./ledger", () => ({
  ledgerMonitorReads: () => ({
    paidClaims: () => Effect.succeed({ rows: [], head: 1, next: null }),
    postedResults: () => Effect.succeed({ rows: [], head: 1, next: null }),
  }),
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
      ENVIRONMENT: "staging",
      LAUNCH: { rosterCohorts: calls.cohorts },
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

it("does not enumerate past slot rosters during periodic value checks", async () => {
  calls.season.mockReturnValue(Effect.succeed(null));
  calls.cohorts.mockRejectedValue(new Error("past slots must not be read by tick"));
  const worker = monitor();
  for (let tick = 0; tick < 4; tick++) await worker.tick();
  expect(calls.cohorts).not.toHaveBeenCalled();
  expect((await worker.health()).success).toBe(true);
  expect(calls.pause).not.toHaveBeenCalled();
});
