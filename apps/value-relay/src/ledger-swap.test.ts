import { hash } from "starknet";
import { beforeEach, expect, it, vi } from "vitest";
import worker, { ValueMonitor } from "./monitor-worker";

/** Two ledgers on one chain: A first exists at block 10, B at block 40, and B's first paid claim is in block 40. */
const chain = vi.hoisted(() => ({
  head: 50,
  ledger: { address: "0xa1", deployed: 10 },
  deployments: { "0xa1": 10, "0xb2": 40 } as Record<string, number>,
  events: [] as { address: string; block_number: number; keys: string[]; data: string[] }[],
  reads: [] as { address: string; from: number; keys: string[]; returned: number }[],
  /** Ledgers whose first page comes back empty with a continuation token, as an RPC paging a long block range does. */
  paging: new Set<string>(),
}));
vi.mock("./environment", async (original) => ({
  ...(await original<typeof import("./environment")>()),
  ledgerAddress: () => chain.ledger.address,
  ledgerContractOf: () => ({ contractAddress: chain.ledger.address, deploymentBlock: chain.ledger.deployed }),
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
vi.mock("@realms-world/value-ledger", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger")>()),
  rpcAt: () => ({
    getChainId: async () => "0x1",
    getClassHashAt: async (address: string, block: number) => {
      const first = chain.deployments[address];
      if (first === undefined || block < first) throw Object.assign(new Error("Contract not found"), { code: 20 });
      return "0xc1a55";
    },
    getBlock: async (number: number | "latest") => {
      const block = number === "latest" ? chain.head : number;
      return { block_number: block, block_hash: `0x${block.toString(16)}`, status: "ACCEPTED_ON_L2", timestamp: block };
    },
    getEvents: (request: {
      address: string;
      from_block: { block_number: number };
      to_block: { block_number: number };
      keys: string[][];
      continuation_token?: string;
    }) => {
      if (chain.paging.has(request.address) && !request.continuation_token) {
        chain.reads.push({
          address: request.address,
          from: request.from_block.block_number,
          keys: request.keys[0]!,
          returned: 0,
        });
        return Promise.resolve({ events: [], continuation_token: "range-2" });
      }
      const events = chain.events
        .filter(
          (event) =>
            BigInt(event.address) === BigInt(request.address) &&
            event.block_number >= request.from_block.block_number &&
            event.block_number <= request.to_block.block_number &&
            request.keys[0]!.includes(event.keys[0]!),
        )
        .map(({ address, ...event }) => ({
          ...event,
          from_address: address,
          block_hash: `0x${event.block_number.toString(16)}`,
          transaction_hash: "0xdef",
        }));
      chain.reads.push({
        address: request.address,
        from: request.from_block.block_number,
        keys: request.keys[0]!,
        returned: events.length,
      });
      return Promise.resolve({ events });
    },
  }),
}));

const settings = {
  ENVIRONMENT: "production",
  L2_RPC_URL: "https://ledger.test",
  OPERATOR_TOKEN: "test-token",
  PAUSER_ACCOUNT_ADDRESS: "0x2",
  PAUSER_PRIVATE_KEY: "0x3",
};
/** Durable Object storage survives restarts; instances do not. */
const storages = new Map<string, Map<string, unknown>>();
const storageOf = (name: string) => {
  const data = storages.get(name) ?? new Map<string, unknown>();
  storages.set(name, data);
  const storage = {
    transaction: async <T>(run: (tx: unknown) => Promise<T>): Promise<T> => run(storage),
    get: async (key: string) => data.get(key),
    put: async (key: string, value: unknown) => {
      data.set(key, value);
    },
    delete: async (key: string) => data.delete(key),
  };
  return storage;
};
let instances = new Map<string, ValueMonitor>();
const env = {
  ...settings,
  IDENTITY: { l2ChainId: async () => "0x1", shards: async () => [] },
  RELAY_REPORT: { held: async () => [] },
  MONITOR: {
    idFromName: (name: string) => name,
    get: (name: string) => {
      const monitor = instances.get(name) ?? new ValueMonitor({ storage: storageOf(name) } as never, env as never);
      instances.set(name, monitor);
      return monitor;
    },
  },
};
const restart = () => {
  instances = new Map();
};
const tick = async () => {
  chain.reads = [];
  await worker.scheduled({} as ScheduledController, env as never);
};
const health = async () =>
  (await (await worker.fetch(new Request("https://play.test/api/operator/monitor/health"), env as never)).json()) as {
    cursors?: Record<string, { fromBlock?: number; page: string | null }>;
    value_error: string | null;
  };
/** Where each audited stream started reading on the last tick, and on which ledger. */
const auditReads = () =>
  ["WithdrawalPaid", "ResultsApplied"].map((name) => {
    const read = chain.reads.find((row) => row.keys.includes(hash.getSelectorFromName(name)));
    return read && { address: read.address, from: read.from, returned: read.returned };
  });
const useLedger = (address: string) => {
  chain.ledger = { address, deployed: chain.deployments[address]! };
};

beforeEach(() => {
  storages.clear();
  chain.paging.clear();
  restart();
  chain.head = 50;
  useLedger("0xa1");
  chain.events = [
    {
      address: "0xb2",
      block_number: 40,
      keys: [hash.getSelectorFromName("WithdrawalPaid"), "0x1", "0xabc"],
      data: ["0x2", "0x999", "0x5", "0x0"],
    },
  ];
});

it("starts a new ledger's audit at its own first block after a completed scan of the old ledger, across a restart", async () => {
  await tick();
  expect(auditReads()).toEqual([
    { address: "0xa1", from: 10, returned: 0 },
    { address: "0xa1", from: 10, returned: 0 },
  ]);
  const scannedA = await health();
  expect(scannedA.cursors?.paidClaims).toMatchObject({ fromBlock: 51, page: null });

  useLedger("0xb2");
  chain.head = 51;
  restart();
  await tick();
  // B's history is read from its deployment block, and the claim in that block reaches the audit.
  expect(auditReads()).toEqual([
    { address: "0xb2", from: 40, returned: 1 },
    { address: "0xb2", from: 40, returned: 0 },
  ]);
  // A's state stays A's: its cursor is untouched, never continued for B.
  expect(storages.get("monitor:0xa1")!.get("progress")).toMatchObject({
    cursors: { paidClaims: { fromBlock: 51, page: null } },
  });
  expect(storages.get("monitor:0xa1")!.get("ledgerState:ledger")).toBe("0xa1");
  expect(storages.get("monitor:0xb2")!.get("ledgerState:ledger")).toBe("0xb2");
});

it("does not continue an old ledger's in-flight page for a new ledger", async () => {
  // A's first pass is in flight, holding a continuation token, when the ledger changes: prod's state at today's swap.
  chain.paging.add("0xa1");
  await tick();
  expect((await health()).cursors?.postedResults).toMatchObject({ fromBlock: 10, page: expect.any(String) });
  useLedger("0xb2");
  restart();
  await tick();
  expect(auditReads()).toEqual([
    { address: "0xb2", from: 40, returned: 1 },
    { address: "0xb2", from: 40, returned: 0 },
  ]);
  expect(storages.get("monitor:0xa1")!.get("progress")).toMatchObject({
    cursors: { postedResults: { fromBlock: 10, page: expect.any(String) } },
  });
});

it("resumes each ledger from its own saved cursor when the ledger changes back", async () => {
  await tick();
  useLedger("0xb2");
  chain.head = 51;
  await tick();
  useLedger("0xa1");
  chain.head = 52;
  restart();
  await tick();
  // A resumes after its own pass through block 50; it neither rescans nor inherits B's progress.
  expect(auditReads()).toEqual([
    { address: "0xa1", from: 51, returned: 0 },
    { address: "0xa1", from: 51, returned: 0 },
  ]);
});

it("refuses to continue one ledger's state for another, rather than skipping its events", async () => {
  const monitor = env.MONITOR.get("monitor:0xa1");
  await monitor.tick();
  const before = storages.get("monitor:0xa1")!.get("progress");
  useLedger("0xb2");
  chain.head = 51;
  chain.reads = [];
  expect(await monitor.tick()).toMatchObject({ value_error: "ledger_state_belongs_to_another_ledger" });
  expect(chain.reads).toEqual([]);
  expect(storages.get("monitor:0xa1")!.get("progress")).toEqual(before);
  expect((await monitor.health()).success).toBe(false);
});
