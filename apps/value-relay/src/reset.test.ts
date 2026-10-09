import { expect, it } from "vitest";
import { DurableRelayStore } from "./state";
const setup = (progress: unknown) => {
  const data = new Map<string, unknown>([["progress", progress]]);
  const storage = {
    list: async ({ prefix }: { prefix: string }) => new Map([...data].filter(([key]) => key.startsWith(prefix))),
    get: async (key: string) => data.get(key),
    put: async (key: string, value: unknown) => {
      data.set(key, value);
    },
    delete: async (key: string) => data.delete(key),
    transaction: async (run: (tx: unknown) => Promise<unknown>): Promise<unknown> => run(storage),
  };
  return { data, store: new DurableRelayStore(storage as unknown as DurableObjectStorage) };
};
it("reanchors and rereads the faulting block without skipping a withdrawal", async () => {
  const f = setup({ nextBlock: 5, lastHash: "0x4", halted: "parent_hash_changed:5" });
  expect(await f.store.reset("parent_hash_changed:5", "Verified canonical parent", "0x44")).toMatchObject({
    nextBlock: 5,
    lastHash: "0x44",
    page: null,
    halted: null,
  });
  expect(f.data.get("reset:1")).toMatchObject({ row: "parent_hash_changed:5" });
});
it("resets a fault on a multi-block page from its first block, and rewinds a changed observed block", async () => {
  const f = setup({
    nextBlock: 5,
    lastHash: "0x4",
    halted: "invalid_confirmed_block:10",
    page: { head: 10, hash: "0xa", token: "next" },
  });
  expect(await f.store.reset("invalid_confirmed_block:10", "Corrected provider", "0x44")).toMatchObject({
    nextBlock: 5,
    lastHash: "0x44",
    page: null,
  });
  const observed = setup({ nextBlock: 5, lastHash: "0x4", halted: "confirmed_block_changed:4" });
  expect(await observed.store.reset("confirmed_block_changed:4", "Canonical rewrite reviewed", "0x3")).toMatchObject({
    nextBlock: 4,
    lastHash: "0x3",
    page: null,
  });
});

it("discards stale queued rows for the replay range and keeps older confirmed obligations", async () => {
  const f = setup({ nextBlock: 5, lastHash: "0x4", halted: "parent_hash_changed:5" });
  f.data.set("withdrawal:old", { blockNumber: 4 });
  f.data.set("withdrawal:rewritten", { blockNumber: 5 });
  f.data.set("queue:withdrawal:", "stale-cursor");
  await f.store.reset("parent_hash_changed:5", "Reorg evidence reviewed", "0x44");
  expect(f.data.has("withdrawal:old")).toBe(true);
  expect(f.data.has("withdrawal:rewritten")).toBe(false);
  expect(f.data.has("queue:withdrawal:")).toBe(false);
  await f.store.observe({
    chainId: "0x1",
    number: 5,
    hash: "0x55",
    parentHash: "0x44",
    status: "ACCEPTED_ON_L2",
    withdrawals: [
      { chainId: "0x1", seasonId: 1, transactionHash: "replacement", amount: "1", realmsId: "0x1", confirmedAt: 1 },
    ],
    results: [],
  });
  expect(await f.store.progress()).toMatchObject({ nextBlock: 6, lastHash: "0x55" });
  expect(f.data.has("withdrawal:replacement")).toBe(true);
});
