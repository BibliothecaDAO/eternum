import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, expect, it, vi } from "vitest";
import { createIndexer as instantiateIndexer } from "@apibara/indexer";
import { generateIndexerId } from "@apibara/indexer/internal";
import { MMR_HISTORY_CHECKPOINT_ID, starknet_mmr_updates } from "@realms-world/db/schema";
let client: PGlite | undefined;
afterEach(async () => {
  await client?.close();
  vi.unstubAllEnvs();
});
it("constructs the existing insert-only MMR history feed and exposes its actual cursor identifier", async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/realms_test");
  const { createIndexer } = await import("./strk-mmr-updates.indexer");
  client = new PGlite();
  const database = drizzle(client, { schema: { starknet_mmr_updates } });
  expect(() => instantiateIndexer(createIndexer({ database }))).not.toThrow();
  expect(generateIndexerId("strk-mmr-updates", "starknet-mmr-updates")).toBe(MMR_HISTORY_CHECKPOINT_ID);
});
