const address = vi.hoisted(() => vi.fn(() => "0x10"));
vi.mock("./environment", () => ({ ledgerAddress: address }));
import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
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
  activeShards: async () => [{ chainId: "0x1" }],
  readRegisteredShard: async () => ({ chainId: "0x1", rpcUrl: "https://shard.test", contracts: { games: "0x2" } }),
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
vi.mock("./shard-labor", () => ({ currentLaborDay: () => Effect.succeed(4), writeLaborGrants: shard.grant }));
vi.mock("./shard-enrolment", () => ({ enrolShardOperator: vi.fn(), shardOperatorAddress: () => "0x5" }));
beforeEach(() => {
  vi.clearAllMocks();
  address.mockReturnValue("0x10");
});
it("records unavailable ledger work while shard ingestion and owned Realm labor continue", async () => {
  address.mockImplementation(() => {
    throw new Error("ledger not deployed");
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
        realmOwnerOf: async () => "0x4",
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
  shard.grant.mockReturnValue(Effect.succeed([{ gameId: 7, account: "0x3", home: "0x8", amount: "1" }]));
  const claim = {
    realms: [{ gameId: 7, home: "0x8", realmId: "8" }],
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
  await relay.alarm();
  expect(shard.page).toHaveBeenLastCalledWith(0, 0, "cursor");
  expect(storage.setAlarm).toHaveBeenCalledOnce();
  expect(data.get("progress")).toMatchObject({ nextBlock: 1 });
});
