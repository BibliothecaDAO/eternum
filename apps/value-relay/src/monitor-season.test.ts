vi.mock("./environment", async (original) => ({
  ...(await original<typeof import("./environment")>()),
  ledgerAddress: () => "0x10",
}));
import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { ValueMonitor } from "./monitor-worker";

const calls = vi.hoisted(() => ({ pause: vi.fn(), season: vi.fn(), cohorts: vi.fn(), directory: vi.fn() }));
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
    reportedSettlements: () =>
      Effect.succeed({
        rows: [],
        next: null,
        head: 0,
        anchor: { number: 0, hash: "0x1" },
        rewind: false,
        fromBlock: 0,
      }),
    reportedClaims: () =>
      Effect.succeed({
        rows: [],
        next: null,
        head: 0,
        anchor: { number: 0, hash: "0x1" },
        rewind: false,
        fromBlock: 0,
      }),
    paidClaims: () =>
      Effect.succeed({ rows: [], head: 1, anchor: { number: 1, hash: "0xa" }, rewind: false, next: null }),
    postedResults: () =>
      Effect.succeed({ rows: [], head: 1, anchor: { number: 1, hash: "0xa" }, rewind: false, next: null }),
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
      L2_RPC_URL: "https://ledger.test",
      ENVIRONMENT: "staging",
      LAUNCH: { rosterCohorts: calls.cohorts, directoryGames: calls.directory },
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

/** Shard chains as the shard deploy names them, `<ENVIRONMENT>_<time>` in ASCII. */
const chainNamed = (name: string) => `0x${Buffer.from(name).toString("hex")}`;
const DEV_CHAIN = chainNamed("DEV_18de3131a6e90bc7");
const PRODUCTION_CHAIN = chainNamed("PRODUCTION_18de3131a6e90bc7");
it("answers no slot for a dev-shard result the launch directory declares outside any slot, without pausing value", async () => {
  calls.cohorts.mockResolvedValue([]);
  calls.directory.mockResolvedValue([{ chainId: DEV_CHAIN, games: [{ gameId: 9, slotId: null }] }]);
  expect(await monitor().verifyRoster(DEV_CHAIN, 9)).toBeNull();
  expect(calls.pause).not.toHaveBeenCalled();
});
it.each([
  ["a paid game whose slot cohort is missing", DEV_CHAIN, [{ gameId: 9, slotId: 4 }]],
  ["a game the directory does not list", DEV_CHAIN, [{ gameId: 8, slotId: null }]],
  ["a production game, even declared outside any slot", PRODUCTION_CHAIN, [{ gameId: 9, slotId: null }]],
])("refuses to clear the result of %s", async (_case, chainId, games) => {
  calls.cohorts.mockResolvedValue([]);
  calls.directory.mockResolvedValue([{ chainId, games }]);
  await expect(monitor().verifyRoster(chainId, 9)).rejects.toThrow();
  expect(calls.pause).not.toHaveBeenCalled();
});
