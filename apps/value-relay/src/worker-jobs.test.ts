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
import { beforeEach, expect, it, vi } from "vitest";
import { ValuePlaneAddressMissingError } from "@realms-world/chain";
import worker, { ValueRelay } from "./worker";

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
beforeEach(() => {
  vi.clearAllMocks();
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
    {} as ScheduledController,
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
      RELAY: { idFromName: (id: string) => id, get: () => ({ ledgerTick: () => relay.ledgerTick(), tick }) },
      IDENTITY: {},
    } as never,
  );
  expect(tick).toHaveBeenCalledWith("0x1");
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
