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
import { RatingReader } from "./rating-reader";

const header = { block_number: 77, block_hash: "0xabc" };
const history = { ...header, players: Array.from({ length: 24 }, (_, i) => `0x${(i + 1).toString(16)}`) };
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
  const paid: Record<string, unknown>[][] = [];
  const network = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes("/api/ratings/population"))
      return init?.method === "HEAD"
        ? new Response(null, {
            headers: { "x-rating-hash": history.block_hash, "x-rating-block": String(history.block_number) },
          })
        : Response.json(history);
    const raw = JSON.parse(String(init?.body));
    const batch = (Array.isArray(raw) ? raw : [raw]) as { id: number; method: string; params?: unknown }[];
    paid.push(batch);
    const answers = [...batch].reverse().map((call) => ({
      jsonrpc: "2.0",
      id: call.id,
      result:
        call.method === "starknet_specVersion"
          ? "0.9.0"
          : call.method === "starknet_chainId"
            ? "0x534e5f4d41494e"
            : call.method === "starknet_getBlockWithTxHashes"
              ? header
              : ["0x3635c9adc5dea00000", "0x0"],
    }));
    return Response.json(Array.isArray(raw) ? answers : answers[0]);
  });
  const reader = new RatingReader(
    ctx as unknown as DurableObjectState,
    {
      ENVIRONMENT: "production",
      RATING_TOKEN_ADDRESS: "0x31",
      RATING_HISTORY_URL: "https://realms.world/api/ratings/population",
      IDENTITY_RPC_URL: "https://starknet-mainnet.g.alchemy.com/v2/test",
    } as never,
  );
  vi.stubGlobal("fetch", network);
  return { reader, paid, network, database, ctx };
};

it("re-reads named blocks and latest values without retaining a snapshot table", async () => {
  const { reader, paid, database } = create();
  try {
    const first = await reader.ratings(history.players, "0xabc");
    const before = paid.length;
    expect((await reader.ratings(history.players, "0xabc")).values).toEqual(first.values);
    expect(paid.length).toBeGreaterThan(before);
    expect(database.prepare("SELECT name FROM sqlite_master WHERE name='snapshots'").all()).toEqual([]);
    await expect(reader.ratings(history.players, "0xdef")).rejects.toThrow("Wrong rating block");
  } finally {
    vi.unstubAllGlobals();
    database.close();
  }
});
it("ranks fresh token values for the immutable history population", async () => {
  const { reader, paid, database } = create();
  try {
    const first = await reader.top();
    const before = paid.length;
    expect(first.entries).toHaveLength(24);
    expect((await reader.top()).entries).toEqual(first.entries);
    expect(paid.length).toBeGreaterThan(before);
    expect(paid.flat().some((call) => call.method === "starknet_getEvents")).toBe(false);
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
      RATING_TOKEN_ADDRESS: "0x31",
      RATING_HISTORY_URL: "https://realms.world/api/ratings/population",
      IDENTITY_RPC_URL: "https://starknet-mainnet.g.alchemy.com/v2/test",
    });
    const before = paid.length;
    await expect(restarted.ratings(["0x1"], "0xabc")).rejects.toThrow("budget");
    expect(paid).toHaveLength(before);
  } finally {
    vi.unstubAllGlobals();
    database.close();
  }
});
