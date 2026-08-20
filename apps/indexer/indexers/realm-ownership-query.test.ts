import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getRealmOwnershipInventory,
  normalizeRealmOwnerAddress,
  starknetRealmMetadata,
  starknetRealmOwnership,
  starknetRealmOwnershipStatus,
} from "@realms-world/db";

const TEST_TIMEOUT_MS = 15_000;
const NOW = new Date("2026-08-21T10:00:00.000Z");

describe("getRealmOwnershipInventory", () => {
  let client: PGlite;
  let database: ReturnType<typeof drizzle>;

  beforeEach(async () => {
    client = new PGlite();
    await client.exec(`
      CREATE TABLE starknet_realm_ownership (
        _id text PRIMARY KEY NOT NULL,
        token_id numeric NOT NULL,
        owner text NOT NULL,
        block_number numeric NOT NULL,
        transaction_hash text NOT NULL,
        event_index integer NOT NULL
      );
      CREATE TABLE starknet_realm_metadata (
        _id text PRIMARY KEY NOT NULL,
        metadata text NOT NULL
      );
      CREATE TABLE starknet_realm_ownership_status (
        _id text PRIMARY KEY NOT NULL,
        latest_block_number numeric NOT NULL,
        latest_block_timestamp timestamp with time zone NOT NULL,
        last_processed_at timestamp with time zone NOT NULL,
        has_reached_head boolean DEFAULT false NOT NULL
      );
    `);
    database = drizzle(client);
  });

  afterEach(async () => {
    await client.close();
  });

  it("canonicalizes padded wallet addresses for indexed owner lookups", () => {
    expect(normalizeRealmOwnerAddress("0x000A")).toBe("0xa");
    expect(() => normalizeRealmOwnerAddress("0x0")).toThrow(
      "Invalid Starknet wallet address",
    );
  });

  it(
    "reports syncing instead of an empty wallet before the initial replay completes",
    async () => {
      expect(await getRealmOwnershipInventory(database, "0xa", NOW)).toEqual({
        status: "syncing",
        tokens: [],
        checkpoint: null,
      });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "returns current ownership once the checkpoint reaches the head",
    async () => {
      await database.insert(starknetRealmOwnershipStatus).values({
        _id: "starknet-realms-ownership",
        latest_block_number: "2500000",
        latest_block_timestamp: new Date("2026-08-21T09:59:00.000Z"),
        last_processed_at: NOW,
        has_reached_head: true,
      });
      await database.insert(starknetRealmOwnership).values({
        _id: "17",
        token_id: "17",
        owner: "0xa",
        block_number: "2499999",
        transaction_hash: "0xabc",
        event_index: 3,
      });
      await database.insert(starknetRealmMetadata).values({
        _id: "17",
        metadata: '{"name":"Realm #17"}',
      });

      expect(await getRealmOwnershipInventory(database, "0xa", NOW)).toEqual({
        status: "ready",
        checkpoint: {
          blockNumber: "2500000",
          blockTimestamp: "2026-08-21T09:59:00.000Z",
        },
        tokens: [
          {
            token_id: "17",
            owner: "0xa",
            metadata: '{"name":"Realm #17"}',
          },
        ],
      });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "reports a previously healthy checkpoint as stale after updates stop",
    async () => {
      await database.insert(starknetRealmOwnershipStatus).values({
        _id: "starknet-realms-ownership",
        latest_block_number: "2400000",
        latest_block_timestamp: new Date("2026-08-21T09:30:00.000Z"),
        last_processed_at: new Date("2026-08-21T09:30:01.000Z"),
        has_reached_head: true,
      });

      expect(
        await getRealmOwnershipInventory(database, "0xa", NOW),
      ).toMatchObject({ status: "stale", tokens: [] });
    },
    TEST_TIMEOUT_MS,
  );
});
