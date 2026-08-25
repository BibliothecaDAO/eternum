import { createIndexer as instantiateIndexer } from "@apibara/indexer";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  starknetRealmOwnership,
  starknetRealmOwnershipStatus,
} from "@realms-world/db/schema";

describe("Starknet Realm ownership indexer", () => {
  let client: PGlite | undefined;

  afterEach(async () => {
    await client?.close();
    vi.unstubAllEnvs();
  });

  it("constructs its Drizzle storage plugin from the database schema", async () => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://test:test@localhost:5432/realms_test",
    );
    vi.stubEnv("VITE_PUBLIC_CHAIN", "mainnet");
    const { createIndexer } = await import("./strk-realms-ownership.indexer");

    client = new PGlite();
    const database = drizzle(client, {
      schema: {
        starknetRealmOwnership,
        starknetRealmOwnershipStatus,
      },
    });

    expect(() => instantiateIndexer(createIndexer({ database }))).not.toThrow();
  });
});
