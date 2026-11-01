import { expect, it, vi } from "vitest";
import { DurableRelayStore } from "./state";
import type { ConfirmedBlock, Withdrawal } from "./ports";
const setup = () => {
  const data = new Map<string, unknown>();
  const storage = {
    list: async ({
      prefix,
      startAfter,
      end,
      reverse,
      limit = 1000,
    }: {
      prefix: string;
      startAfter?: string;
      end?: string;
      reverse?: boolean;
      limit?: number;
    }) =>
      new Map(
        [...data]
          .filter(([key]) => key.startsWith(prefix) && (!startAfter || key > startAfter) && (!end || key < end))
          .sort(([a], [b]) => (reverse ? b.localeCompare(a) : a.localeCompare(b)))
          .slice(0, limit),
      ),
    get: async (key: string) => data.get(key),
    put: async (key: string, value: unknown) => {
      if (new TextEncoder().encode(JSON.stringify(value)).length > 128 * 1024) throw new Error("record_size_limit");
      data.set(key, value);
    },
    delete: async (key: string) => data.delete(key),
    transaction: async (run: (tx: unknown) => Promise<unknown>): Promise<unknown> => run(storage),
  };
  return { data, store: new DurableRelayStore(storage as unknown as DurableObjectStorage) };
};
const withdrawal = (number: number): Withdrawal => ({
  prizeRank: 0,
  prizeCount: 0,
  blockNumber: number,
  chainId: "0x1",
  seasonId: 1,
  transactionHash: `0x${number + 10}`,
  amount: "1",
  realmsId: "0x1",
  confirmedAt: number,
});
const block = (number: number): ConfirmedBlock => ({
  chainId: "0x1",
  number,
  hash: `0x${number + 1}`,
  parentHash: `0x${number}`,
  status: "ACCEPTED_ON_L2",
  withdrawals: [withdrawal(number)],
  results: [],
});
const seed = async () => {
  const f = setup();
  for (let number = 0; number <= 5; number++) await f.store.observe(block(number));
  return f;
};
it("walks below rewritten ancestors and replays only when no discarded claim was paid", async () => {
  const f = await seed();
  await f.store.hold({ kind: "payment", withdrawal: withdrawal(3), reason: "ledger_season_closed" });
  await f.store.halt("confirmed_block_changed:5");
  const read = vi.fn(async (number: number) => (number >= 3 ? `0x${number + 100}` : block(number).hash));
  expect(
    await f.store.resetFromChain("confirmed_block_changed:5", "Restored node rewrote blocks 3 through 5", {
      head: async () => 5,
      paid: async () => false,
      hash: read,
    }),
  ).toMatchObject({ nextBlock: 3, lastHash: block(2).hash, halted: null, page: null });
  expect(read.mock.calls.map(([n]) => n)).toEqual([5, 4, 3, 2, 2]);
  expect(await f.store.withdrawals()).toEqual([withdrawal(0), withdrawal(1), withdrawal(2)]);
  expect(await f.store.held()).toEqual([]);
  expect(f.data.get("reset:1")).toMatchObject({
    fork: { number: 2, hash: block(2).hash },
  });
  for (let number = 3; number <= 5; number++)
    await f.store.observe({
      ...block(number),
      hash: await read(number),
      withdrawals: [{ ...withdrawal(number), transactionHash: `new-${number}` }],
    });
  expect((await f.store.withdrawals()).map((row) => row.transactionHash)).toEqual(
    expect.arrayContaining(["new-3", "new-4", "new-5"]),
  );
  expect(await f.store.progress()).toMatchObject({ nextBlock: 6 });
});
it("starts before a changed parent instead of keeping its old obligation", async () => {
  const f = await seed();
  await f.store.halt("parent_hash_changed:6");
  await f.store.resetFromChain("parent_hash_changed:6", "Parent rewrite reviewed", {
    paid: async () => false,
    head: async () => 6,
    hash: async (n) => (n >= 4 ? "0xff" : block(n).hash),
  });
  expect(await f.store.progress()).toMatchObject({ nextBlock: 4, lastHash: block(3).hash });
  expect((await f.store.withdrawals()).some((row) => row.blockNumber! >= 4)).toBe(false);
});
it("refuses a reset whose proven anchor changes while the fork walk is in flight", async () => {
  const f = await seed();
  await f.store.halt("confirmed_block_changed:5");
  const read = vi.fn().mockResolvedValueOnce("0xff").mockResolvedValueOnce(block(4).hash).mockResolvedValueOnce("0xee");
  await expect(
    f.store.resetFromChain("confirmed_block_changed:5", "Provider stabilized", {
      head: async () => 5,
      hash: read,
      paid: async () => false,
    }),
  ).rejects.toThrow("reset_anchor_changed");
  expect((await f.store.progress()).halted).toBe("confirmed_block_changed:5");
  expect(await f.store.withdrawals()).toHaveLength(6);
  await expect(
    f.store.reset("confirmed_block_changed:5", "Unproven new anchor", { number: 4, hash: "0xee" }),
  ).rejects.toThrow("reset_anchor_changed");
});
it("handles a regressed head and safely replays legacy state with no proven hashes", async () => {
  const f = await seed();
  await f.store.halt("confirmed_head_regressed:5");
  await f.store.resetFromChain("confirmed_head_regressed:5", "Restore rolled back the head", {
    paid: async () => false,
    head: async () => 2,
    hash: async (n) => block(n).hash,
  });
  expect(await f.store.progress()).toMatchObject({ nextBlock: 3, lastHash: block(2).hash });
  const legacy = setup();
  legacy.data.set("progress", { nextBlock: 20, lastHash: "0xff", halted: "confirmed_block_changed:19" });
  legacy.data.set("withdrawal:old", { transactionHash: "old" });
  await legacy.store.resetFromChain("confirmed_block_changed:19", "Legacy cursor has no fork evidence", {
    paid: async () => false,
    head: async () => 19,
    hash: async () => "0xff",
  });
  expect(await legacy.store.progress()).toMatchObject({ nextBlock: 0, lastHash: null });
  expect(await legacy.store.withdrawals()).toEqual([]);
});
it("prunes hashes below the oldest queued obligation and retains its parent", async () => {
  const f = await seed();
  for (let number = 0; number <= 3; number++) await f.store.completeWithdrawal(withdrawal(number).transactionHash);
  await f.store.observe(block(6));
  expect([...f.data.keys()].filter((key) => key.startsWith("block:")).map((key) => Number(key.slice(6)))).toEqual([
    3, 4, 5, 6,
  ]);
});
it("refuses an incomplete multi-block hash catalogue", async () => {
  const f = setup();
  await expect(
    f.store.observe({ ...block(5), fromBlock: 3, anchors: [{ number: 5, hash: block(5).hash }] }),
  ).rejects.toThrow("incomplete_block_anchors");
  expect(await f.store.withdrawals()).toEqual([]);
});
it("replays an unfinished event range even when its pinned head still matches", async () => {
  const f = setup();
  for (let number = 0; number < 5; number++) await f.store.observe(block(number));
  await f.store.observe({
    ...block(10),
    fromBlock: 5,
    next: "remaining-events",
    anchors: [5, 6, 7, 8, 9, 10].map((number) => ({ number, hash: block(number).hash })),
  });
  await f.store.halt("invalid_confirmed_block:10");
  await f.store.resetFromChain("invalid_confirmed_block:10", "Retry the unfinished confirmed event page", {
    paid: async () => false,
    head: async () => 10,
    hash: async (number) => block(number).hash,
  });
  expect(await f.store.progress()).toMatchObject({ nextBlock: 5, lastHash: block(4).hash, page: null });
  expect((await f.store.withdrawals()).some((row) => row.blockNumber === 10)).toBe(false);
});

it.each([false, true])(
  "refuses discarded paid claims, including lost acknowledgments (completed=%s)",
  async (completed) => {
    const f = await seed();
    if (completed) await f.store.completeWithdrawal(withdrawal(4).transactionHash);
    await f.store.halt("confirmed_block_changed:5");
    const before = structuredClone([...f.data]);
    const paid = vi.fn(async (row: Withdrawal) => row.transactionHash === withdrawal(4).transactionHash);
    await expect(
      f.store.resetFromChain("confirmed_block_changed:5", "Restore after payment", {
        head: async () => 5,
        hash: async (n) => (n >= 3 ? "0xff" : block(n).hash),
        paid,
      }),
    ).rejects.toThrow("reset_discards_paid_claims");
    expect([...f.data]).toEqual(before);
    expect(paid.mock.calls.map(([row]) => row.blockNumber)).toContain(4);
  },
);
it("refuses to discard pending evidence when ledger payment verification is unavailable", async () => {
  const f = await seed();
  await f.store.halt("confirmed_block_changed:5");
  await expect(
    f.store.resetFromChain("confirmed_block_changed:5", "Restore under investigation", {
      head: async () => 5,
      hash: async (n) => (n >= 3 ? "0xff" : block(n).hash),
      paid: async () => {
        throw new Error("ledger_unavailable");
      },
    }),
  ).rejects.toThrow("ledger_unavailable");
  expect((await f.store.progress()).halted).toBe("confirmed_block_changed:5");
  expect(await f.store.withdrawals()).toHaveLength(6);
});
it("checks completed payment history beyond the first storage page without resetting it", async () => {
  const f = await seed();
  for (let i = 0; i < 1001; i++)
    f.data.set(`paid:${String(i).padStart(4, "0")}`, {
      ...withdrawal(4),
      transactionHash: "0x" + (100 + i).toString(16),
    });
  await f.store.halt("confirmed_block_changed:5");
  const paid = vi.fn(async (row: Withdrawal) => row.transactionHash === "0x44c");
  await expect(
    f.store.resetFromChain("confirmed_block_changed:5", "Restore rewrote paid range", {
      head: async () => 5,
      hash: async (n) => (n >= 3 ? "0xff" : block(n).hash),
      paid,
    }),
  ).rejects.toThrow("reset_discards_paid_claims");
  expect(paid.mock.calls.some(([row]) => row.transactionHash === "0x44c")).toBe(true);
  expect((await f.store.progress()).halted).toBe("confirmed_block_changed:5");
  expect(f.data.has("reset:1")).toBe(false);
});
