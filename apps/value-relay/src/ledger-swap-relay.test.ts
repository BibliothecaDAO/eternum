import { response } from "../../../packages/value-ledger/test-support/abi";
import { ledgerAbi } from "../../../packages/value-ledger/test-support/ledger-abi";
import { hash } from "starknet";
import { beforeEach, expect, it, vi } from "vitest";
import worker, { ValueRelay } from "./worker";

/** Two ledgers on one chain: A first exists at block 10, with a chest request waiting; B first exists at block 40. */
const chain = vi.hoisted(() => ({
  head: 50,
  ledger: { address: "0xa1", deployed: 10 },
  deployments: { "0xa1": 10, "0xb2": 40 } as Record<string, number>,
  events: [] as { address: string; block_number: number; keys: string[]; data: string[] }[],
  reads: [] as { address: string; from: number; keys: string[] }[],
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
    getBlockNumber: async () => chain.head,
    // A's chest 7 was requested for block 1000, so it stays pending: nothing is due to finish.
    callContract: async () =>
      response(ledgerAbi, "get_chest", {
        exists: true,
        season_id: 1,
        band: 2,
        requested: true,
        finished: false,
        requester: "0x123",
        request_block: 1000,
      }),
    getEvents: (request: {
      address: string;
      from_block: { block_number: number };
      to_block: { block_number: number };
      keys: string[][];
    }) => {
      chain.reads.push({ address: request.address, from: request.from_block.block_number, keys: request.keys[0]! });
      return Promise.resolve({
        events: chain.events
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
          })),
      });
    },
  }),
}));

const settings = {
  ENVIRONMENT: "production",
  BASE_URL: "https://play.realms.test",
  L2_RPC_URL: "https://ledger.test",
  OPERATOR_TOKEN: "test-token",
  SHARD_LEDGER_OPERATOR_PRIVATE_KEY: "0x1",
  LEDGER_OPERATOR_ADDRESS: "0x2",
  LEDGER_OPERATOR_PRIVATE_KEY: "0x3",
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
    list: async ({ prefix, limit, startAfter }: { prefix: string; limit: number; startAfter?: string }) =>
      new Map(
        [...data]
          .filter(([key]) => key.startsWith(prefix) && (!startAfter || key > startAfter))
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(0, limit),
      ),
    setAlarm: async () => {},
  };
  return storage;
};
let instances = new Map<string, ValueRelay>();
const env = {
  ...settings,
  IDENTITY: { l2ChainId: async () => "0x1", shards: async () => [] },
  RELAY: {
    idFromName: (name: string) => name,
    get: (name: string) => {
      const relay = instances.get(name) ?? new ValueRelay({ storage: storageOf(name) } as never, env as never);
      instances.set(name, relay);
      return relay;
    },
  },
};
const tick = async () => {
  chain.reads = [];
  instances = new Map();
  await worker.scheduled({} as ScheduledController, env as never);
};
const chestReads = () => chain.reads.filter((read) => read.keys.includes(hash.getSelectorFromName("ChestRequested")));
const seasonReads = () => chain.reads.filter((read) => read.keys.includes(hash.getSelectorFromName("SeasonOpened")));

beforeEach(() => {
  storages.clear();
  chain.head = 50;
  chain.ledger = { address: "0xa1", deployed: 10 };
  chain.events = [
    {
      address: "0xa1",
      block_number: 20,
      keys: [hash.getSelectorFromName("ChestRequested"), "7", "0", "0x123"],
      data: ["1000"],
    },
  ];
});

it("gives a new ledger its own chest and season history, never the old ledger's queue or cursors", async () => {
  await tick();
  expect(chestReads()).toEqual([expect.objectContaining({ address: "0xa1", from: 10 })]);
  expect(seasonReads()).toEqual([expect.objectContaining({ address: "0xa1", from: 10 })]);
  const a = storages.get("ledger:0xa1")!;
  expect(a.get("chests:request:7")).toMatchObject({ tokenId: "7", requestBlock: 1000 });
  expect(a.get("lastTick")).toMatchObject({ chests: { pending: 1, checked: 1 }, chest_error: null });

  chain.ledger = { address: "0xb2", deployed: 40 };
  chain.head = 51;
  await tick();
  // B's chests and seasons are read from B's first block; A's waiting chest is not B's work.
  expect(chestReads()).toEqual([expect.objectContaining({ address: "0xb2", from: 40 })]);
  expect(seasonReads()).toEqual([expect.objectContaining({ address: "0xb2", from: 40 })]);
  const b = storages.get("ledger:0xb2")!;
  expect(b.get("lastTick")).toMatchObject({ chests: { pending: 0, checked: 0 }, chest_error: null });
  expect([...b.keys()].filter((key) => key.startsWith("chests:request:"))).toEqual([]);
  // A's state is kept as it was, for A.
  expect(a.get("chests:cursor")).toMatchObject({ fromBlock: 51 });
  expect(a.get("chests:request:7")).toBeDefined();
});

it("refuses to run one ledger's chest and season state for another", async () => {
  const relay = env.RELAY.get("ledger:0xa1");
  await relay.ledgerTick();
  chain.ledger = { address: "0xb2", deployed: 40 };
  chain.reads = [];
  expect(await relay.ledgerTick()).toMatchObject({
    seasons: { error: "ledger_state_belongs_to_another_ledger" },
    chest_error: "ledger_state_belongs_to_another_ledger",
  });
  expect(chain.reads).toEqual([]);
});
