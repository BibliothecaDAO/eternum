import { hash } from "starknet";
import { expect, it, vi } from "vitest";
import { ValueMonitor } from "./monitor-worker";

const ledger = vi.hoisted(() => ({
  head: 50,
  reads: [] as { from: number; keys: string[] }[],
  events: [] as { block_number: number; keys: string[] }[],
}));
vi.mock("./environment", async (original) => ({
  ...(await original<typeof import("./environment")>()),
  ledgerAddress: () => "0x10",
  // The address book's deployment block: the fake ledger first exists at block 5.
  ledgerContractOf: () => ({ contractAddress: "0x10", deploymentBlock: 5 }),
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
    getClassHashAt: async (_address: string, block: number) => {
      if (block < 5) throw Object.assign(new Error("Contract not found"), { code: 20 });
      return "0xc1a55";
    },
    getBlock: async (number: number | "latest") => {
      const block = number === "latest" ? ledger.head : number;
      return { block_number: block, block_hash: `0x${block.toString(16)}`, status: "ACCEPTED_ON_L2", timestamp: block };
    },
    getEvents: (request: {
      from_block: { block_number: number };
      to_block: { block_number: number };
      keys: string[][];
    }) => {
      ledger.reads.push({ from: request.from_block.block_number, keys: request.keys[0]! });
      const inRange = ledger.events.filter(
        (event) =>
          event.block_number >= request.from_block.block_number &&
          event.block_number <= request.to_block.block_number &&
          request.keys[0]!.includes(event.keys[0]!),
      );
      // One page of 100, as the ledger's chunk size asks.
      return Promise.resolve({
        events: inRange.slice(0, 100),
        ...(inRange.length > 100 ? { continuation_token: "next" } : {}),
      });
    },
  }),
}));

const monitorWithStorage = () => {
  const data = new Map<string, unknown>();
  const storage = {
    transaction: async <T>(run: (tx: unknown) => Promise<T>): Promise<T> => run(storage),
    get: async (key: string) => data.get(key),
    put: async (key: string, value: unknown) => {
      data.set(key, value);
    },
    delete: async (key: string) => data.delete(key),
  };
  return Object.assign(
    new ValueMonitor(
      { storage } as unknown as DurableObjectState,
      {
        L2_RPC_URL: "https://ledger.test",
        IDENTITY: { l2ChainId: async () => "0x1", shards: async () => [] },
      } as never,
    ),
    { data },
  );
};

/** Where each audited stream (paid claims, posted results) started reading on this tick. */
const auditStarts = () =>
  ["WithdrawalPaid", "ResultsApplied"].map(
    (name) => ledger.reads.find((read) => read.keys.includes(hash.getSelectorFromName(name)))?.from,
  );

it("audits only new blocks on the tick after a finished pass, through the worker's own ledger reads", async () => {
  const monitor = monitorWithStorage();
  expect((await monitor.tick()).value_error).toBeNull();
  // Both streams read their whole history once, from the ledger's deployment block.
  expect(auditStarts()).toEqual([5, 5]);

  ledger.head = 51;
  ledger.reads = [];
  expect((await monitor.tick()).value_error).toBeNull();
  // No new events since block 50: the saved anchor still matches, so neither stream rescans its history.
  expect(auditStarts()).toEqual([51, 51]);
});

it("resets a halt the previous version recorded, reading the halted row's page at its saved anchor", async () => {
  const chainId = "0x4445565f31";
  const paymentHash = "0xabc";
  ledger.head = 52;
  const payment = (block: number, claim: string) =>
    ({
      block_number: block,
      block_hash: `0x${block.toString(16)}`,
      transaction_hash: "0xdef",
      from_address: "0x10",
      keys: [hash.getSelectorFromName("WithdrawalPaid"), chainId, claim],
      data: ["0x2", "0x999", "0x5", "0x0", "0", "0"],
    }) as never;
  // A full page of earlier payments, then the halted one on the page after the saved anchor.
  ledger.events = [
    ...Array.from({ length: 100 }, (_, index) => payment(10, `0x${(index + 1).toString(16)}`)),
    payment(51, paymentHash),
  ];
  const monitor = monitorWithStorage();
  // The previous version halted with no fault row; its cursor had already passed block 50 with its anchor.
  monitor.data.set("progress", {
    halted: `paid_claim_mismatch:${paymentHash}`,
    cursors: { paidClaims: { fromBlock: 51, page: null, anchor: { number: 50, hash: "0x32" } } },
  });
  expect(await monitor.reset(`paidClaims:${chainId}:${paymentHash}`, "Investigated")).toMatchObject({ halted: null });
});
