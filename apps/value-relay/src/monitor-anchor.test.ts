import { hash } from "starknet";
import { expect, it, vi } from "vitest";
import { ValueMonitor } from "./monitor-worker";

const ledger = vi.hoisted(() => ({ head: 50, reads: [] as { from: number; keys: string[] }[] }));
vi.mock("./environment", async (original) => ({
  ...(await original<typeof import("./environment")>()),
  ledgerAddress: () => "0x10",
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
    getBlock: async (number: number | "latest") => {
      const block = number === "latest" ? ledger.head : number;
      return { block_number: block, block_hash: `0x${block.toString(16)}`, status: "ACCEPTED_ON_L2", timestamp: block };
    },
    getEvents: async ({ from_block, keys }: { from_block: { block_number: number }; keys: string[][] }) => {
      ledger.reads.push({ from: from_block.block_number, keys: keys[0]! });
      return { events: [] };
    },
  }),
}));

const monitorWithStorage = () => {
  const data = new Map<string, unknown>();
  const storage = {
    get: async (key: string) => data.get(key),
    put: async (key: string, value: unknown) => {
      data.set(key, value);
    },
  };
  return new ValueMonitor(
    { storage } as unknown as DurableObjectState,
    {
      L2_RPC_URL: "https://ledger.test",
      IDENTITY: { l2ChainId: async () => "0x1", shards: async () => [] },
    } as never,
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
  // Both streams read their whole history once.
  expect(auditStarts()).toEqual([0, 0]);

  ledger.head = 51;
  ledger.reads = [];
  expect((await monitor.tick()).value_error).toBeNull();
  // No new events since block 50: the saved anchor still matches, so neither stream rewinds to block 0.
  expect(auditStarts()).toEqual([51, 51]);
});
