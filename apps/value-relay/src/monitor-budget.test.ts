vi.mock("./environment", async (original) => ({
  ...(await original<typeof import("./environment")>()),
  ledgerAddress: () => "0x10",
}));
import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { ValueMonitor } from "./monitor-worker";
import { RelayFailure } from "./ports";

const calls = vi.hoisted(() => ({
  pause: vi.fn(),
  balance: vi.fn(),
  season: vi.fn(),
  cohorts: vi.fn(),
  directory: vi.fn(),
  custody: vi.fn<typeof import("./deposit-conservation").auditDepositCustody>(),
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
vi.mock("./deposit-conservation", async (original) => ({
  ...(await original<typeof import("./deposit-conservation")>()),
  auditDepositCustody: calls.custody,
}));
vi.mock("./chain", () => ({ ledgerPauserAdapter: () => calls.pause }));
const ports = vi.hoisted(() => ({
  reportedClaims: vi.fn(),
  paidClaims: vi.fn(),
  postedResults: vi.fn(),
  frontierPool: vi.fn(),
  finalFrontierPool: vi.fn(),
}));
vi.mock("./ledger", () => ({ ledgerMonitorReads: () => ports }));
beforeEach(() => {
  vi.clearAllMocks();
  calls.pause.mockReturnValue(Effect.void);
  calls.custody.mockResolvedValue(null);
  calls.balance.mockResolvedValue({
    account: "0x9",
    token: "0x10",
    balance_wei: "1000000000000000000",
    low_balance_threshold_wei: "100000000000000000",
    warning: null,
    block_number: 10,
  });
});

const page = { rows: [], head: 1, anchor: { number: 1, hash: "0xa" }, rewind: false, next: null };
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-14T12:00:30Z"));
  calls.pause.mockReturnValue(Effect.void);
  calls.custody.mockResolvedValue(null);
  calls.season.mockReturnValue(Effect.succeed(null));
  calls.balance.mockResolvedValue({
    account: "0x9",
    token: "0x10",
    balance_wei: "1000000000000000000",
    low_balance_threshold_wei: "100000000000000000",
    warning: null,
    block_number: 10,
  });
  ports.reportedClaims.mockReturnValue(Effect.succeed({ ...page, head: 0, fromBlock: 0 }));
  ports.paidClaims.mockReturnValue(Effect.succeed(page));
  ports.postedResults.mockReturnValue(Effect.succeed(page));
});
const storage = new Map<string, unknown>();
const monitorOver = (data: Map<string, unknown>) =>
  new ValueMonitor(
    {
      storage: {
        get: async (key: string) => data.get(key),
        put: async (key: string, value: unknown) => void data.set(key, value),
        delete: async (key: string) => data.delete(key),
      },
    } as unknown as DurableObjectState,
    {
      L2_RPC_URL: "https://ledger.test",
      PAUSER_ACCOUNT_ADDRESS: "0x9",
      ENVIRONMENT: "staging",
      LAUNCH: { rosterCohorts: calls.cohorts, directoryGames: calls.directory },
      IDENTITY: { l2ChainId: async () => "0x1", shards: async () => [] },
      RELAY_REPORT: { held: async () => [] },
    } as never,
  );
/** Every chain read an audit makes: the three ledger streams, the season audit, the deposit custody and the balance. */
const chainReads = () =>
  [ports.reportedClaims, ports.paidClaims, ports.postedResults, calls.season, calls.custody, calls.balance].reduce(
    (total, read) => total + read.mock.calls.length,
    0,
  );
const AUDIT = 6;
/** Runs the cron for these minutes, as the Worker does: asks every minute, says `hourly` on the hour. */
async function minutes(worker: ValueMonitor, from: number, to: number, onMinute?: (minute: number) => Promise<void>) {
  for (let minute = from; minute < to; minute++) {
    if (minute > 0) vi.advanceTimersByTime(60_000);
    await onMinute?.(minute);
    await worker.auditIfDue(minute % 60 === 0);
  }
}

it("makes one audit an hour on quiet minutes", async () => {
  storage.clear();
  await minutes(monitorOver(storage), 0, 180);
  expect(chainReads()).toBe(3 * AUDIT);
});
it("makes one more audit for one cause, and none for a second cause that the same audit covers", async () => {
  storage.clear();
  const worker = monitorOver(storage);
  await minutes(worker, 0, 60, async (minute) => {
    if (minute === 10) await worker.ledgerWritten();
  });
  expect(chainReads()).toBe(2 * AUDIT);
});
it("retries a failed audit every five minutes until it succeeds, across a restart, and then is quiet", async () => {
  storage.clear();
  ports.paidClaims.mockReturnValue(Effect.fail(new RelayFailure({ operation: "ledger paid claims unavailable" })));
  await minutes(monitorOver(storage), 0, 11);
  // The hour's audit at minute 0 and its retries at 5 and 10 each reached the failing stream.
  expect(ports.paidClaims).toHaveBeenCalledTimes(3);
  ports.paidClaims.mockReturnValue(Effect.succeed(page));
  const restarted = monitorOver(storage);
  await minutes(restarted, 11, 16);
  expect(ports.paidClaims).toHaveBeenCalledTimes(4);
  const reads = chainReads();
  await minutes(restarted, 16, 60);
  expect(chainReads()).toBe(reads);
});
it("does not keep retrying a halted monitor", async () => {
  storage.clear();
  ports.paidClaims.mockReturnValue(Effect.fail(new RelayFailure({ operation: "ledger paid claims unavailable" })));
  const worker = monitorOver(storage);
  vi.spyOn(worker, "tick").mockResolvedValue({
    value: { halted: "lords_conservation:7:10" },
    value_error: "x",
    season_error: null,
  } as never);
  await minutes(worker, 0, 30);
  expect(worker.tick).toHaveBeenCalledTimes(1);
});
