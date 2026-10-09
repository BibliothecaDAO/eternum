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
    { IDENTITY_RPC_URL: "https://paid.test" } as never,
  );
  vi.stubGlobal("fetch", network);
  return { reader, paid, network, database, ctx };
};

it("shares concurrent24-owner reads and serves a pinned warm answer without a paid request", async () => {
  const { reader, paid, database } = create();
  try {
    const replies = await Promise.all(Array.from({ length: 24 }, () => reader.ratings(history.players)));
    expect(replies.every((reply) => reply.values.length === 24)).toBe(true);
    expect(paid.filter((batch) => batch.some((call) => call.method === "starknet_call"))).toHaveLength(1);
    expect(paid.find((batch) => batch.some((call) => call.method === "starknet_call"))).toHaveLength(24);
    const before = paid.length;
    expect((await reader.ratings(history.players, "0xabc")).values).toEqual(replies[0]!.values);
    expect(paid).toHaveLength(before);
    await expect(reader.ratings(history.players, "0xdef")).rejects.toThrow("snapshot");
    expect(paid).toHaveLength(before);
  } finally {
    vi.unstubAllGlobals();
    database.close();
  }
});

it("computes a whole ranking once for different readers and limits, using SQL population, never getEvents", async () => {
  const { reader, paid, network, database } = create();
  try {
    const first = await reader.top();
    expect(first.entries).toHaveLength(24);
    const before = paid.length;
    expect((await reader.top()).entries).toEqual(first.entries);
    expect(paid).toHaveLength(before);
    expect(network.mock.calls.some(([url]) => String(url).includes("/api/ratings/population"))).toBe(true);
    expect(paid.flat().some((call) => call.method === "starknet_getEvents")).toBe(false);
  } finally {
    vi.unstubAllGlobals();
    database.close();
  }
});

it("keeps the per-minute paid-method budget across a reader restart", async () => {
  const { reader, paid, database, ctx } = create();
  try {
    const first = await reader.ratings(["0x1"]);
    const cached = paid.length;
    const restarted = new RatingReader(ctx as unknown as DurableObjectState, { IDENTITY_RPC_URL: "https://paid.test" });
    expect((await restarted.ratings(["0x1"], first.block_hash)).values).toEqual(first.values);
    expect(paid).toHaveLength(cached);
    await ctx.storage.put("rpc-budget", { minute: Math.floor(Date.now() / 60000), used: 10000 });
    expect((await reader.ratings(["0x1"], first.block_hash)).values).toEqual(first.values);
    await expect(reader.ratings(["0x2"], first.block_hash)).rejects.toThrow("budget");
    expect(paid).toHaveLength(cached);
  } finally {
    vi.unstubAllGlobals();
    database.close();
  }
});

it("counts cold and warm upstream HTTP requests separately from billed RPC methods", async () => {
  const { reader, paid, database } = create();
  try {
    await reader.ratings(history.players);
    const cold = { http: paid.length, methods: paid.reduce((sum, batch) => sum + batch.length, 0) };
    const start = paid.length;
    await reader.ratings(history.players);
    const warm = {
      http: paid.length - start,
      methods: paid.slice(start).reduce((sum, batch) => sum + batch.length, 0),
    };
    expect(cold).toEqual({ http: 2, methods: 26 });
    expect(warm).toEqual({ http: 1, methods: 1 });
    await reader.ratings(history.players, "0xabc");
    expect(paid.length - start).toBe(1);
  } finally {
    vi.unstubAllGlobals();
    database.close();
  }
});

it("counts top20's1000-holder cold computation and free warm computation", async () => {
  const saved = history.players;
  history.players = Array.from({ length: 1000 }, (_, i) => `0x${(i + 1).toString(16)}`);
  const { reader, paid, database } = create();
  try {
    expect((await reader.top()).entries).toHaveLength(1000);
    expect({ http: paid.length, methods: paid.reduce((sum, batch) => sum + batch.length, 0) }).toEqual({
      http: 11,
      methods: 1002,
    });
    const before = paid.length;
    expect((await reader.top()).entries).toHaveLength(1000);
    expect(paid).toHaveLength(before);
  } finally {
    history.players = saved;
    vi.unstubAllGlobals();
    database.close();
  }
});
