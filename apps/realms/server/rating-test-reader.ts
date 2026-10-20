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

/**
 * API tests use the real reader and budget storage; only the network is replaced. They read dev's book ("staging"),
 * which names a deployed rating token; production's book has none until its own setup deploys one, and it stays
 * fail-closed meanwhile.
 */
export function testRatingReader(configuration: Partial<ConstructorParameters<typeof RatingReader>[1]> = {}) {
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
    ENVIRONMENT: "staging",
    L2_RPC_URL: "https://starknet-mainnet.g.alchemy.com/v2/test",
    ...configuration,
  });
  return { binding: { idFromName: () => "mainnet", get: () => reader }, close: () => database.close() };
}
