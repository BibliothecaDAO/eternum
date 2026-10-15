import { DatabaseSync } from "node:sqlite";
import { expect, it, vi } from "vitest";
vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    constructor(
      public ctx: unknown,
      public env: unknown,
    ) {}
  },
}));
import { hash } from "starknet";
import { RatingReader } from "./rating-reader";

const MMR_UPDATED = hash.getSelectorFromName("MMRUpdated");
interface RpcCall {
  id: number;
  method: string;
  params: {
    block_id: "latest" | { block_number?: number; block_hash?: string };
    filter: { from_block: { block_number: number }; to_block: { block_number: number } };
  };
}
const BLOCK_NOT_FOUND = { error: { code: 24, message: "Block not found" } };
const DEPLOYED_AT = 10;
const players = Array.from({ length: 24 }, (_, i) => `0x${(i + 1).toString(16)}`);
const create = () => {
  const database = new DatabaseSync(":memory:");
  const values = new Map<string, unknown>();
  const sql = {
    exec: (query: string, ...args: unknown[]) => {
      const statement = database.prepare(query);
      const rows = statement.all(...(args as never[]));
      return { toArray: () => rows };
    },
  };
  const ctx = {
    storage: {
      sql,
      get: async (key: string) => values.get(key),
      put: async (key: string, value: unknown) => {
        values.set(key, value);
      },
    },
  };
  /**
   * A chain whose blocks from a fork's height onwards belong to that fork's branch, the latest fork winning. A block's
   * hash names its branch, and an update counts only on the branch it was emitted on.
   */
  const chain = {
    head: 77,
    forks: [] as { at: number; branch: string }[],
    updates: players.map((player): [number, string, string] => [20, player, "a"]),
    afterEvents: (_first: number) => {},
  };
  const branchOf = (block: number) => [...chain.forks].reverse().find(({ at }) => at <= block)?.branch ?? "a";
  const hashAt = (block: number) => `0x${block.toString(16)}${branchOf(block)}`;
  const header = (blockId: RpcCall["params"]["block_id"]) => {
    if (blockId === "latest") return { result: { block_number: chain.head, block_hash: hashAt(chain.head) } };
    if (blockId.block_number !== undefined)
      return blockId.block_number <= chain.head
        ? { result: { block_number: blockId.block_number, block_hash: hashAt(blockId.block_number) } }
        : BLOCK_NOT_FOUND;
    const block = BigInt(blockId.block_hash!) >> 4n;
    return block <= chain.head && hashAt(Number(block)) === blockId.block_hash
      ? { result: { block_number: Number(block), block_hash: blockId.block_hash } }
      : BLOCK_NOT_FOUND;
  };
  const failing = new Set<number>();
  const paid: RpcCall[][] = [];
  const answer = (call: RpcCall) => {
    if (call.method === "starknet_getClassHashAt")
      return (call.params.block_id as { block_number: number }).block_number >= DEPLOYED_AT
        ? { result: "0x1" }
        : { error: { code: 20, message: "Contract not found" } };
    if (call.method === "starknet_getEvents") {
      const { from_block, to_block } = call.params.filter;
      if (failing.has(from_block.block_number)) return { error: { code: 63, message: "Unexpected error" } };
      const inRange = chain.updates.filter(
        ([block, , branch]) =>
          block >= from_block.block_number &&
          block <= Math.min(to_block.block_number, chain.head) &&
          branchOf(block) === branch,
      );
      chain.afterEvents(from_block.block_number);
      return { result: { events: inRange.map(([, player]) => ({ keys: [MMR_UPDATED, player], data: [] })) } };
    }
    if (call.method === "starknet_getBlockWithTxHashes") return header(call.params.block_id);
    return {
      result:
        call.method === "starknet_specVersion"
          ? "0.9.0"
          : call.method === "starknet_chainId"
            ? "0x534e5f4d41494e"
            : ["0x3635c9adc5dea00000", "0x0"],
    };
  };
  const network = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const raw = JSON.parse(String(init?.body));
    const batch = (Array.isArray(raw) ? raw : [raw]) as RpcCall[];
    paid.push(batch);
    const answers = [...batch].reverse().map((call) => ({ jsonrpc: "2.0", id: call.id, ...answer(call) }));
    return Response.json(Array.isArray(raw) ? answers : answers[0]);
  });
  const reader = new RatingReader(ctx as unknown as DurableObjectState, {
    ENVIRONMENT: "production",
    L2_RPC_URL: "https://starknet-mainnet.g.alchemy.com/v2/test",
  });
  vi.stubGlobal("fetch", network);
  const eventRanges = () =>
    paid
      .flat()
      .filter((call) => call.method === "starknet_getEvents")
      .map(({ params }) => [params.filter.from_block.block_number, params.filter.to_block.block_number]);
  const ranked = async () => (await reader.top()).entries.map(({ player }) => player);
  return { reader, paid, chain, hashAt, failing, eventRanges, ranked, database, ctx };
};

it("re-reads named blocks and latest values without retaining a snapshot table", async () => {
  const { reader, paid, hashAt, database } = create();
  try {
    const first = await reader.ratings(players, hashAt(77));
    const before = paid.length;
    expect((await reader.ratings(players, hashAt(77))).values).toEqual(first.values);
    expect(paid.length).toBeGreaterThan(before);
    expect(database.prepare("SELECT name FROM sqlite_master WHERE name='snapshots'").all()).toEqual([]);
    await expect(reader.ratings(players, "0xdef")).rejects.toThrow("Block not found");
  } finally {
    vi.unstubAllGlobals();
    database.close();
  }
});
it("ranks every wallet the token has updated, reading each block of its events once", async () => {
  const { reader, chain, eventRanges, database } = create();
  try {
    const first = await reader.top();
    expect(first.entries).toHaveLength(24);
    expect(first.entries[0]).toEqual({ player: "0x1", rank: 1, rating: "1000" });
    expect((await reader.top()).entries).toEqual(first.entries);
    chain.head = 78;
    chain.updates.push([78, "0x0a", "a"], [78, "0x99", "a"]);
    expect((await reader.top()).entries.map(({ player }) => player)).toEqual([...players, "0x99"]);
    expect(eventRanges()).toEqual([
      [DEPLOYED_AT, 77],
      [78, 78],
    ]);
  } finally {
    vi.unstubAllGlobals();
    database.close();
  }
});
it("publishes nothing when an event read fails, then resumes after the last block range it finished", async () => {
  const { reader, chain, failing, eventRanges, database } = create();
  try {
    chain.head = 250_000;
    chain.updates.push([150_000, "0x99", "a"]);
    failing.add(100_010);
    await expect(reader.top()).rejects.toThrow();
    failing.clear();
    expect((await reader.top()).entries).toHaveLength(25);
    expect(eventRanges()).toEqual([
      [DEPLOYED_AT, 100_009],
      [100_010, 200_009],
      [100_010, 200_009],
      [200_010, 250_000],
    ]);
  } finally {
    vi.unstubAllGlobals();
    database.close();
  }
});
it("keeps the paid-method budget across a reader restart with no cached bypass", async () => {
  const { reader, paid, database, ctx } = create();
  try {
    await reader.ratings(["0x1"]);
    await ctx.storage.put("rpc-budget", { minute: Math.floor(Date.now() / 60000), used: 10000 });
    const restarted = new RatingReader(ctx as unknown as DurableObjectState, {
      ENVIRONMENT: "production",
      L2_RPC_URL: "https://starknet-mainnet.g.alchemy.com/v2/test",
    });
    const before = paid.length;
    await expect(restarted.ratings(["0x1"], "0x4da")).rejects.toThrow("budget");
    expect(paid).toHaveLength(before);
  } finally {
    vi.unstubAllGlobals();
    database.close();
  }
});

it("reads the population again when the block it was read through is replaced at the same height", async () => {
  const { chain, eventRanges, ranked, database } = create();
  try {
    expect(await ranked()).toEqual(players);
    chain.forks.push({ at: 77, branch: "b" });
    chain.updates.push([77, "0x99", "b"]);
    expect(await ranked()).toEqual([...players, "0x99"]);
    expect(eventRanges()).toEqual([
      [DEPLOYED_AT, 77],
      [DEPLOYED_AT, 77],
    ]);
  } finally {
    vi.unstubAllGlobals();
    database.close();
  }
});
it("drops a wallet whose only update was rolled back, and refuses to rank while the chain is behind its read", async () => {
  const { reader, chain, ranked, database } = create();
  try {
    chain.head = 78;
    chain.updates.push([78, "0x77", "a"]);
    expect(await ranked()).toEqual([...players, "0x77"]);
    chain.head = 77;
    await expect(reader.top()).rejects.toThrow("ahead of the chain's head");
    chain.forks.push({ at: 78, branch: "b" });
    chain.head = 78;
    expect(await ranked()).toEqual(players);
  } finally {
    vi.unstubAllGlobals();
    database.close();
  }
});
it("publishes nothing when the chain changes branch under a scan, then ranks only the new branch's wallets", async () => {
  const { reader, chain, ranked, database } = create();
  try {
    chain.head = 250_000;
    chain.updates.push([150_000, "0x99", "a"], [150_000, "0x98", "b"]);
    chain.afterEvents = (first) => {
      if (first === 100_010 && !chain.forks.length) chain.forks.push({ at: 150_000, branch: "b" });
    };
    await expect(reader.top()).rejects.toThrow("changed branch during scan");
    expect(await ranked()).toEqual([...players, "0x98"]);
  } finally {
    vi.unstubAllGlobals();
    database.close();
  }
});
