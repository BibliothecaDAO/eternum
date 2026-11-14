const sweep = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("./frontier-sweep", () => ({ sweepFrontierLords: sweep }));
vi.mock("./frontier-prizes", () => ({ awardFrontierPrizes: vi.fn(async () => {}) }));
const pools = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("./frontier-pools", () => ({ publishFrontierPools: pools }));
const address = vi.hoisted(() => vi.fn(() => "0x10"));
vi.mock("./environment", async (original) => ({
  ...(await original<typeof import("./environment")>()),
  ledgerAddress: address,
  ledgerContractOf: () => ({ contractAddress: address(), deploymentBlock: 1 }),
}));
import { Effect } from "effect";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ValuePlaneAddressMissingError } from "@realms-world/chain";
import worker, { ValueRelay } from "./worker";
import { RelayFailure } from "./ports";

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
  requireActiveChain: async () => {},
  relayAccountAddress: () => "0x5",
  activeShards: async () => [{ chainId: "0x1" }],
  readRegisteredShard: async () => ({
    chainId: "0x1",
    rpcUrl: "https://shard.test",
    contracts: { games: "0x2" },
    releaseSchemas: { "1": "0xs" },
  }),
}));
const deposits = vi.hoisted(() => vi.fn());
vi.mock("./deposits", async (original) => ({
  ...(await original<typeof import("./deposits")>()),
  relayDeposits: deposits,
}));
const seasons = vi.hoisted(() => vi.fn());
vi.mock("./season-tops", () => ({ processSeasonTops: seasons }));
const runRelayCalls = vi.hoisted(() => vi.fn());
const runRelayOutcome = vi.hoisted(() => ({ next: undefined as undefined | (() => unknown) }));
vi.mock("./relay", async (original) => {
  const real = await original<typeof import("./relay")>();
  return {
    ...real,
    runRelay: (...args: Parameters<typeof real.runRelay>) => {
      runRelayCalls(...args);
      return runRelayOutcome.next
        ? (runRelayOutcome.next() as ReturnType<typeof real.runRelay>)
        : real.runRelay(...args);
    },
  };
});
const finish = vi.hoisted(() => vi.fn());
vi.mock("./chests", () => ({ DurableChestStore: class {}, finishRequestedChests: finish }));
it("runs ledger-wide chest work independently of any configured shard", async () => {
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
  const observation = await relay.ledgerTick();
  expect(observation.chests).toEqual({ finished: 1, failed: 0, pending: 0 });
  expect(finish).toHaveBeenCalledOnce();
  expect((await relay.ledgerHealth()).success).toBe(false);
  expect(data.has("lastTick")).toBe(true);
});

const shard = vi.hoisted(() => ({ head: vi.fn(), page: vi.fn(), header: vi.fn(), grant: vi.fn() }));
vi.mock("./shard-rpc", async (original) => ({
  ...(await original<typeof import("./shard-rpc")>()),
  ShardReader: class {
    constructor(public connection: unknown) {}
    head = shard.head;
    header = shard.header;
    page = shard.page;
  },
}));
vi.mock("./shard-labor", () => ({ currentLaborDay: () => Effect.succeed(4), writeLaborGrant: shard.grant }));
vi.mock("./shard-account", () => ({ joinShardOperator: vi.fn(async () => "0x5") }));
afterEach(() => {
  vi.useRealTimers();
});
beforeEach(() => {
  vi.clearAllMocks();
  runRelayOutcome.next = undefined;
  seasons.mockReturnValue(Effect.fail(new RelayFailure({ operation: "season_unavailable" })));
  address.mockReturnValue("0x10");
});
it("records unavailable ledger work while shard ingestion and owned Realm labor continue", async () => {
  address.mockImplementation(() => {
    throw new ValuePlaneAddressMissingError("ledger", "production");
  });
  const data = new Map<string, unknown>();
  const storage = {
    get: async (key: string) => data.get(key),
    put: async (key: string, value: unknown) => {
      data.set(key, value);
    },
    list: async ({ prefix, end }: { prefix: string; end?: string }) =>
      new Map([...data].filter(([key]) => key.startsWith(prefix) && (!end || key < end))),
    delete: async (key: string) => data.delete(key),
    transaction: async (run: (tx: unknown) => Promise<unknown>): Promise<unknown> => run(storage),
  };
  const relay = new ValueRelay(
    { storage } as unknown as DurableObjectState,
    {
      IDENTITY: {
        l2ChainId: async () => "0x1",
        accountForRealmsId: async () => "0x3",
        linkedWallet: async () => "0x4",
        holdsRealm: async () => true,
      },
    } as never,
  );
  const observation = await relay.ledgerTick();
  expect(observation).toMatchObject({ chests: null, chest_error: "ledger chests unavailable" });
  expect((await relay.ledgerHealth()).success).toBe(false);
  shard.head.mockResolvedValue(0);
  shard.page.mockResolvedValue({
    block: { block_number: 0, block_hash: "0x1", status: "ACCEPTED_ON_L2" },
    first: { parent_hash: "0x0" },
    anchors: [{ number: 0, hash: "0x1" }],
    rows: [],
    next: null,
  });
  expect(await relay.tick("0x1")).toMatchObject({ value: { status: "ready" } });
  expect(data.get("progress")).toMatchObject({ nextBlock: 1 });
  expect((await relay.shardHealth()).success).toBe(false);
  shard.grant.mockReturnValue(
    Effect.succeed({ gameId: 7, account: "0x3", home: "0x8", amount: "1", essence: "0", transactionHash: "0xabc" }),
  );
  const claim = {
    gameId: 7,
    home: "0x8",
    chainId: "0x1",
    realmsId: "0x2",
    account: "0x3",
    day: 4,
  };
  await relay.labor(claim);
  expect(shard.grant).toHaveBeenCalledWith(expect.anything(), claim);
  const tick = vi.fn();
  await worker.scheduled(
    { scheduledTime: 0 } as ScheduledController,
    {
      ENVIRONMENT: "staging",
      BASE_URL: "https://app.test",
      L2_RPC_URL: "https://ledger.test",
      OPERATOR_TOKEN: "test",
      SHARD_LEDGER_OPERATOR_PRIVATE_KEY: "0x1",
      COSIGNER_URL: "https://cosigner.test",
      COSIGNER_TOKEN: "test-cosigner-token",
      LEDGER_OPERATOR_ADDRESS: "0x2",
      LEDGER_OPERATOR_PRIVATE_KEY: "0x3",
      RELAY: { idFromName: (id: string) => id, get: () => ({ ledgerTickIfDue: () => relay.ledgerTick(), tick }) },
      IDENTITY: {},
    } as never,
  );
  expect(tick).toHaveBeenCalledWith("0x1", true);
});

const settledDeposits = { enabled: true, processed: 0, next: "1", total: "0", pending: 0, more: false, error: null };
const shardRelay = () => {
  const data = new Map<string, unknown>();
  const storage = {
    get: async (key: string) => data.get(key),
    put: async (key: string, value: unknown) => {
      data.set(key, value);
    },
    setAlarm: async () => {},
    list: async ({ prefix, end }: { prefix: string; end?: string }) =>
      new Map([...data].filter(([key]) => key.startsWith(prefix) && (!end || key < end))),
    delete: async (key: string) => data.delete(key),
    transaction: async (run: (tx: unknown) => Promise<unknown>): Promise<unknown> => run(storage),
  };
  shard.head.mockResolvedValue(0);
  shard.page.mockResolvedValue({
    block: { block_number: 0, block_hash: "0x1", status: "ACCEPTED_ON_L2" },
    first: { parent_hash: "0x0" },
    anchors: [{ number: 0, hash: "0x1" }],
    rows: [],
    next: null,
  });
  return new ValueRelay(
    { storage } as unknown as DurableObjectState,
    {
      ENVIRONMENT: "staging",
      L2_RPC_URL: "https://ledger.test",
      SHARD_LEDGER_OPERATOR_PRIVATE_KEY: "0x1",
      COSIGNER_URL: "https://cosigner.test",
      COSIGNER_TOKEN: "test-cosigner-token",
      IDENTITY: {
        l2ChainId: async () => "0x1",
        accountForRealmsId: async () => "0x3",
        linkedWallet: async () => "0x4",
        holdsRealm: async () => true,
      },
    } as never,
  );
};
it("asks the ledger about held claims on the next tick after an operator's request, and otherwise on the hour", async () => {
  deposits.mockResolvedValue(settledDeposits);
  const relay = shardRelay();
  const reconciling = () => runRelayCalls.mock.calls.map((call) => call[3]);
  await relay.tick("0x1");
  await relay.tick("0x1");
  await relay.requestReconcile();
  await relay.tick("0x1");
  await relay.tick("0x1");
  await relay.tick("0x1", true);
  expect(reconciling()).toEqual([false, false, true, false, true]);
});
it.each([
  [
    "a recovery read that failed",
    () => Effect.succeed({ status: "ready", more: false, deferred: [], reconciled: false }),
  ],
  ["a tick that failed before the recovery", () => Effect.fail(new RelayFailure({ operation: "shard unavailable" }))],
])(
  "keeps an operator's request after %s, and a healthy tick a minute later completes it without another request",
  async (_, outcome) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-14T12:00:30Z"));
    deposits.mockResolvedValue(settledDeposits);
    const relay = shardRelay();
    await relay.tick("0x1");
    runRelayCalls.mockClear();
    runRelayOutcome.next = outcome;
    await relay.requestReconcile();
    await relay.tick("0x1");
    runRelayOutcome.next = () => Effect.succeed({ status: "ready", more: false, deferred: [], reconciled: true });
    await relay.tick("0x1");
    expect(runRelayCalls.mock.calls.map((call) => call[3])).toEqual([true, false]);
    vi.setSystemTime(new Date(Date.now() + 60_000));
    await relay.tick("0x1");
    await relay.tick("0x1");
    expect(runRelayCalls.mock.calls.map((call) => call[3])).toEqual([true, false, true, false]);
  },
);
it("asks again after an hourly reconciliation whose recovery read failed", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-14T12:00:30Z"));
  deposits.mockResolvedValue(settledDeposits);
  const relay = shardRelay();
  await relay.tick("0x1");
  runRelayCalls.mockClear();
  runRelayOutcome.next = () => Effect.succeed({ status: "ready", more: false, deferred: [], reconciled: false });
  await relay.tick("0x1", true);
  runRelayOutcome.next = () => Effect.succeed({ status: "ready", more: false, deferred: [], reconciled: true });
  await relay.tick("0x1");
  expect(runRelayCalls.mock.calls.map((call) => call[3])).toEqual([true, false]);
  vi.setSystemTime(new Date(Date.now() + 60_000));
  await relay.tick("0x1");
  await relay.tick("0x1");
  expect(runRelayCalls.mock.calls.map((call) => call[3])).toEqual([true, false, true, false]);
});
it("looks for deposits on the hour, and between hours only while one is pending", async () => {
  deposits.mockResolvedValue(settledDeposits);
  const relay = shardRelay();
  await relay.tick("0x1");
  expect(deposits).toHaveBeenCalledTimes(1);
  for (let minute = 0; minute < 5; minute++) await relay.tick("0x1");
  expect(deposits).toHaveBeenCalledTimes(1);
  await relay.tick("0x1", true);
  expect(deposits).toHaveBeenCalledTimes(2);
  deposits.mockResolvedValue({ ...settledDeposits, pending: 1, more: true });
  await relay.tick("0x1", true);
  await relay.tick("0x1");
  await relay.tick("0x1");
  expect(deposits).toHaveBeenCalledTimes(5);
  deposits.mockResolvedValue({ ...settledDeposits, error: [{ obligation: "deposit:1", error: "offline" }] });
  await relay.tick("0x1");
  deposits.mockResolvedValue(settledDeposits);
  await relay.tick("0x1");
  await relay.tick("0x1");
  expect(deposits).toHaveBeenCalledTimes(7);
});
it("delivers a landed deposit at once, and a second deposit by the same player right after it", async () => {
  deposits.mockResolvedValue({ ...settledDeposits, processed: 1 });
  const relay = shardRelay();
  await relay.tick("0x1");
  deposits.mockClear();
  await relay.deliverDeposits("0x1");
  await relay.deliverDeposits("0x1");
  expect(deposits).toHaveBeenCalledTimes(2);
});
it("keeps a report that arrives during a pass for the next pass, and lets reports made before a pass share it", async () => {
  const relay = shardRelay();
  await relay.tick("0x1");
  deposits.mockClear();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  deposits.mockImplementationOnce(async () => {
    await gate;
    return settledDeposits;
  });
  deposits.mockResolvedValue(settledDeposits);
  const first = relay.deliverDeposits("0x1");
  while (!deposits.mock.calls.length) await new Promise((resolve) => setTimeout(resolve));
  const during = relay.deliverDeposits("0x1");
  release();
  await Promise.all([first, during]);
  expect(deposits).toHaveBeenCalledTimes(2);
  deposits.mockClear();
  await Promise.all([relay.deliverDeposits("0x1"), relay.deliverDeposits("0x1"), relay.deliverDeposits("0x1")]);
  expect(deposits.mock.calls.length).toBeLessThan(3);
  expect(deposits.mock.calls.length).toBeGreaterThan(0);
});
it("looks again at the next minute's tick after a reported deposit's first pass failed", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-14T12:00:30Z"));
  try {
    deposits.mockResolvedValue(settledDeposits);
    const relay = shardRelay();
    await relay.tick("0x1");
    deposits.mockClear();
    deposits.mockRejectedValueOnce(new Error("ledger unavailable"));
    await expect(relay.deliverDeposits("0x1")).rejects.toThrow();
    deposits.mockResolvedValue(settledDeposits);
    await relay.tick("0x1");
    expect(deposits).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date(Date.now() + 60_000));
    await relay.tick("0x1");
    expect(deposits).toHaveBeenCalledTimes(2);
    await relay.tick("0x1");
    await relay.tick("0x1");
    expect(deposits).toHaveBeenCalledTimes(2);
  } finally {
    vi.useRealTimers();
  }
});

it.each([
  ["a chest still pending", Effect.succeed({ finished: 0, failed: 0, pending: 1 })],
  ["a failed chest", Effect.succeed({ finished: 0, failed: 1, pending: 0 })],
  ["an unavailable chest read", Effect.fail(new RelayFailure({ operation: "ledger chests unavailable" }))],
])("asks the ledger tick again in five minutes, without a new write, after %s", async (_, outcome) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-14T12:00:30Z"));
  try {
    const data = new Map<string, unknown>();
    const ctx = {
      blockConcurrencyWhile: async (run: () => Promise<unknown>) => run(),
      storage: {
        setAlarm: async () => {},
        get: async (key: string) => data.get(key),
        list: async () => new Map(),
        put: async (key: string, value: unknown) => void data.set(key, value),
        delete: async (key: string) => data.delete(key),
      },
    };
    finish.mockReturnValue(outcome);
    seasons.mockReturnValue(Effect.succeed(null));
    const relay = new ValueRelay(
      ctx as unknown as DurableObjectState,
      { IDENTITY: { l2ChainId: async () => "0x1" }, ROSTER_MONITOR: { ledgerWritten: async () => {} } } as never,
    );
    await (relay as unknown as { ledgerWritten(): Promise<void> }).ledgerWritten();
    await relay.ledgerTickIfDue(false);
    expect(finish).toHaveBeenCalledTimes(1);
    for (let minute = 1; minute < 5; minute++) {
      vi.advanceTimersByTime(60_000);
      expect(await relay.ledgerTickIfDue(false)).toBeNull();
    }
    expect(finish).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    finish.mockReturnValue(Effect.succeed({ finished: 1, failed: 0, pending: 0 }));
    await relay.ledgerTickIfDue(false);
    expect(finish).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(600_000);
    expect(await relay.ledgerTickIfDue(false)).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});
it("asks the ledger side to read once an hour while shards tick every minute", async () => {
  const ledgerTickIfDue = vi.fn();
  const tick = vi.fn();
  const env = {
    ENVIRONMENT: "staging",
    BASE_URL: "https://app.test",
    L2_RPC_URL: "https://ledger.test",
    OPERATOR_TOKEN: "test",
    SHARD_LEDGER_OPERATOR_PRIVATE_KEY: "0x1",
    COSIGNER_URL: "https://cosigner.test",
    COSIGNER_TOKEN: "test-cosigner-token",
    LEDGER_OPERATOR_ADDRESS: "0x2",
    LEDGER_OPERATOR_PRIVATE_KEY: "0x3",
    RELAY: { idFromName: (id: string) => id, get: () => ({ ledgerTickIfDue, tick }) },
    IDENTITY: {},
  } as never;
  const minute = 60_000;
  for (let elapsed = 0; elapsed < 120; elapsed++)
    await worker.scheduled({ scheduledTime: elapsed * minute } as ScheduledController, env);
  expect(ledgerTickIfDue).toHaveBeenCalledTimes(120);
  expect(ledgerTickIfDue.mock.calls.filter(([hourly]) => hourly)).toHaveLength(2);
  expect(tick).toHaveBeenCalledTimes(120);
  expect(tick.mock.calls.filter(([, reconcile]) => reconcile)).toHaveLength(2);
});

it("reads the ledger between hours only after the relay wrote to it", async () => {
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
      delete: async (key: string) => data.delete(key),
    },
  };
  finish.mockReturnValue(Effect.succeed({ finished: 0, failed: 0, pending: 0 }));
  const announced = vi.fn(async () => {});
  const relay = new ValueRelay(
    ctx as unknown as DurableObjectState,
    { IDENTITY: { l2ChainId: async () => "0x1" }, ROSTER_MONITOR: { ledgerWritten: announced } } as never,
  );
  const written = () => (relay as unknown as { ledgerWritten(): Promise<void> }).ledgerWritten();
  expect(await relay.ledgerTickIfDue(false)).toBeNull();
  expect(finish).not.toHaveBeenCalled();
  await written();
  expect(announced).toHaveBeenCalledTimes(1);
  expect(await relay.ledgerTickIfDue(false)).not.toBeNull();
  expect(await relay.ledgerTickIfDue(false)).toBeNull();
  expect(finish).toHaveBeenCalledTimes(1);
  expect(await relay.ledgerTickIfDue(true)).not.toBeNull();
  expect(finish).toHaveBeenCalledTimes(2);
});

it("continues a full confirmed page through its alarm and stops when caught up", async () => {
  const data = new Map<string, unknown>();
  const storage = {
    get: async (key: string) => data.get(key),
    put: async (key: string, value: unknown) => {
      data.set(key, value);
    },
    list: async () => new Map(),
    setAlarm: vi.fn(async () => {}),
    transaction: async (run: (tx: unknown) => Promise<unknown>): Promise<unknown> => run(storage),
  };
  const relay = new ValueRelay(
    { storage } as unknown as DurableObjectState,
    { IDENTITY: { l2ChainId: async () => "0x1" } } as never,
  );
  const page = {
    block: { block_number: 0, block_hash: "0x1", status: "ACCEPTED_ON_L2" },
    first: { parent_hash: "0x0" },
    anchors: [{ number: 0, hash: "0x1" }],
    rows: [],
    next: null,
  };
  shard.head.mockResolvedValue(0);
  shard.header.mockResolvedValue({ block_hash: "0x1" });
  shard.page.mockResolvedValueOnce({ ...page, next: "cursor" }).mockResolvedValue(page);
  expect(await relay.tick("0x1")).toMatchObject({ value: { status: "ready", more: true } });
  expect(storage.setAlarm).toHaveBeenCalledOnce();
  expect(pools).toHaveBeenCalledOnce();
  expect(sweep).toHaveBeenCalledWith(
    expect.objectContaining({ chainId: "0x1", accountAddress: "0x5" }),
    undefined,
    expect.objectContaining({ address: "0x10" }),
    expect.any(Function),
    expect.any(Function),
  );
  expect(pools).toHaveBeenCalledWith(
    expect.objectContaining({ chainId: "0x1", accountAddress: "0x5" }),
    undefined,
    expect.objectContaining({ address: "0x10" }),
  );
  await relay.alarm();
  expect(shard.page).toHaveBeenLastCalledWith(0, 0, "cursor");
  expect(storage.setAlarm).toHaveBeenCalledOnce();
  expect(data.get("progress")).toMatchObject({ nextBlock: 1 });
});

it("serializes pool publication with labor on the same shard signer", async () => {
  let release!: () => void;
  let entered!: () => void;
  const holding = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  pools.mockImplementationOnce(async () => {
    entered();
    await holding;
  });
  const data = new Map<string, unknown>();
  const storage = {
    get: async (key: string) => data.get(key),
    put: async (key: string, value: unknown) => {
      data.set(key, value);
    },
    list: async () => new Map(),
    transaction: async (run: (tx: unknown) => Promise<unknown>): Promise<unknown> => run(storage),
  };
  const relay = new ValueRelay(
    { storage } as unknown as DurableObjectState,
    {
      IDENTITY: {
        l2ChainId: async () => "0x1",
        accountForRealmsId: async () => "0x3",
        linkedWallet: async () => "0x4",
        holdsRealm: async () => true,
      },
    } as never,
  );
  shard.head.mockResolvedValue(0);
  shard.page.mockResolvedValue({
    block: { block_number: 0, block_hash: "0x1", status: "ACCEPTED_ON_L2" },
    first: { parent_hash: "0x0" },
    anchors: [{ number: 0, hash: "0x1" }],
    rows: [],
    next: null,
  });
  shard.grant.mockReturnValue(
    Effect.succeed({ gameId: 7, account: "0x3", home: "0x8", amount: "1", essence: "0", transactionHash: "0xabc" }),
  );
  const ticking = relay.tick("0x1");
  await started;
  const claiming = relay.labor({
    gameId: 7,
    home: "0x8",
    chainId: "0x1",
    realmsId: "0x2",
    account: "0x3",
    day: 4,
  });
  try {
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(shard.grant).not.toHaveBeenCalled();
  } finally {
    release();
  }
  await Promise.all([ticking, claiming]);
  expect(shard.grant).toHaveBeenCalledOnce();
});

it("preserves player-facing registration errors across the shard object's RPC boundary", async () => {
  const response = await worker.fetch(
    new Request("https://app.test/api/value/realm-entry?chainId=0x1", {
      method: "POST",
      headers: { origin: "https://app.test", "content-type": "application/json" },
      body: JSON.stringify({ gameId: 7, realmId: 711 }),
    }),
    {
      ENVIRONMENT: "staging",
      BASE_URL: "https://app.test",
      L2_RPC_URL: "https://ledger.test",
      OPERATOR_TOKEN: "test",
      SHARD_LEDGER_OPERATOR_PRIVATE_KEY: "0x1",
      COSIGNER_URL: "https://cosigner.test",
      COSIGNER_TOKEN: "test-cosigner-token",
      LEDGER_OPERATOR_ADDRESS: "0x2",
      LEDGER_OPERATOR_PRIVATE_KEY: "0x3",
      RELAY: {
        idFromName: (id: string) => id,
        get: () => ({ realmEntry: async () => structuredClone({ error: { status: 409, code: "realm_not_owned" } }) }),
      },
      IDENTITY: { authenticate: async () => ({ realmsId: "0x2" }), accountForRealmsId: async () => "0x3" },
    } as never,
  );
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: "realm_not_owned" });
});

it.each(["recover", "upgrade"])(
  "authenticates campaign %s and derives its account without accepting a source override",
  async (action) => {
    const register = vi.fn(async () => ({ entry: { campaign: "devcon-2026", tier: "regular" } }));
    const account = vi.fn(async () => "0x3");
    const env = {
      ENVIRONMENT: "staging",
      BASE_URL: "https://app.test",
      L2_RPC_URL: "https://ledger.test",
      OPERATOR_TOKEN: "test",
      SHARD_LEDGER_OPERATOR_PRIVATE_KEY: "0x1",
      COSIGNER_URL: "https://cosigner.test",
      COSIGNER_TOKEN: "test-cosigner-token",
      LEDGER_OPERATOR_ADDRESS: "0x2",
      LEDGER_OPERATOR_PRIVATE_KEY: "0x3",
      RELAY: { idFromName: (id: string) => id, get: () => ({ realmEntry: register }) },
      IDENTITY: { accountForRealmsId: account },
    };
    const body = { chainId: "0x1", gameId: 7, realmsId: "0x2" };
    const send = (payload: unknown, token = "test") =>
      worker.fetch(
        new Request(
          `https://app.test/api/value/operator/${action === "recover" ? "campaign-entry" : "campaign-upgrade"}`,
          {
            method: "POST",
            headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
            body: JSON.stringify(payload),
          },
        ),
        env as never,
      );
    expect((await send(body, "wrong")).status).toBe(401);
    expect((await send({ ...body, account: "0x9" })).status).toBe(400);
    expect((await send({ ...body, tier: "golden" })).status).toBe(400);
    expect(register).not.toHaveBeenCalled();
    const result = await send(body);
    expect([result.status, await result.json()]).toEqual([200, { campaign: "devcon-2026", tier: "regular" }]);
    expect(account).toHaveBeenCalledExactlyOnceWith("0x2");
    expect(register).toHaveBeenCalledExactlyOnceWith({
      ...body,
      account: "0x3",
      realmId: null,
      ...(action === "recover" ? { recoverFlyer: true } : { upgradeCampaign: true }),
    });
  },
);

it.each([null, "deposit_head_rewritten", [{ obligation: "deposit:1", error: "source unavailable" }]])(
  "deposit progress participates in shard health: %j",
  async (error) => {
    const data = new Map<string, unknown>([
      [
        "shardTick",
        {
          checked_at: Math.floor(Date.now() / 1000),
          value: { status: "ready" },
          funding_error: null,
          deposits: { error },
        },
      ],
    ]);
    const relay = new ValueRelay(
      { storage: { get: async (key: string) => data.get(key) } } as unknown as DurableObjectState,
      {} as never,
    );
    expect((await relay.shardHealth()).success).toBe(error === null);
  },
);

it("authenticates source retirement and refuses source overrides or unresolved obligations", async () => {
  const retire = vi.fn(async () => ({ chainId: "0x1", gamesAddress: "0x2", retirementReady: true }));
  const env = {
    ENVIRONMENT: "staging",
    BASE_URL: "https://app.test",
    L2_RPC_URL: "https://ledger.test",
    OPERATOR_TOKEN: "test",
    SHARD_LEDGER_OPERATOR_PRIVATE_KEY: "0x1",
    COSIGNER_URL: "https://cosigner.test",
    COSIGNER_TOKEN: "test-cosigner-token",
    LEDGER_OPERATOR_ADDRESS: "0x2",
    LEDGER_OPERATOR_PRIVATE_KEY: "0x3",
    RELAY: { idFromName: (id: string) => id, get: () => ({ depositRetirement: retire }) },
    IDENTITY: {},
  };
  const send = (body: unknown, token = "test") =>
    worker.fetch(
      new Request("https://app.test/api/value/operator/deposit-retirement", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      env as never,
    );
  expect((await send({ chainId: "0x1" }, "wrong")).status).toBe(401);
  for (const body of [null, { chainId: "0x1", gamesAddress: "0x9" }, { chainId: "bad" }])
    expect((await send(body)).status).toBe(400);
  expect(retire).not.toHaveBeenCalled();
  expect(await (await send({ chainId: "0x1" })).json()).toEqual({
    chainId: "0x1",
    gamesAddress: "0x2",
    retirementReady: true,
  });
  expect(retire).toHaveBeenCalledWith("0x1");
  retire.mockRejectedValue(new Error("principal_return_pending"));
  expect((await send({ chainId: "0x1" })).status).toBe(409);
});
