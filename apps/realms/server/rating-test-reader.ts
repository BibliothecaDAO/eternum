import { DatabaseSync } from "node:sqlite";
import { vi } from "vitest";
vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    constructor(
      public ctx: unknown,
      public env: unknown,
    ) {}
  },
}));
import { RatingReader } from "./rating-reader";

/** API tests use the real cache and SQL behavior; only the network is replaced. */
export function testRatingReader() {
  const database = new DatabaseSync(":memory:");
  const values = new Map<string, unknown>();
  const ctx = {
    storage: {
      sql: {
        exec: (query: string, ...args: unknown[]) => {
          const rows = database.prepare(query).all(...(args as never[]));
          return { toArray: () => rows };
        },
      },
      get: async (key: string) => values.get(key),
      put: async (key: string, value: unknown) => {
        values.set(key, value);
      },
    },
  };
  const reader = new RatingReader(ctx as unknown as DurableObjectState, {
    IDENTITY_RPC_URL: "https://mainnet.test/rpc",
  });
  return { binding: { idFromName: () => "mainnet", get: () => reader }, close: () => database.close() };
}
