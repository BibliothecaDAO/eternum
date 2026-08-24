import { decodeEvent, getSelector } from "@apibara/starknet";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, describe, expect, it } from "vitest";

import {
  starknetRealmOwnership,
  starknetRealmOwnershipStatus,
} from "@realms-world/db/schema";

import {
  applyRealmTransfer,
  recordOwnershipProgress,
  toRealmTransfer,
} from "./realm-ownership";
import { REALMS_TRANSFER_ABI } from "./realms-transfer-abi";

const TEST_TIMEOUT_MS = 15_000;

describe("Realm ownership transfers", () => {
  let client: PGlite | undefined;

  afterEach(async () => {
    await client?.close();
  });

  it("normalizes a decoded ERC-721 transfer without losing token precision", () => {
    expect(
      toRealmTransfer(
        {
          transactionHash: "0xabc",
          args: {
            from: 0n,
            to: "0x000A",
            token_id: { low: 7n, high: 1n },
          },
        },
        { blockNumber: 664_162n, eventIndex: 3 },
      ),
    ).toEqual({
      tokenId: "340282366920938463463374607431768211463",
      owner: "0xa",
      blockNumber: "664162",
      transactionHash: "0xabc",
      eventIndex: 3,
      burned: false,
    });
  });

  it("marks a transfer to the zero address as a burn", () => {
    expect(
      toRealmTransfer(
        {
          transactionHash: "0xdef",
          args: { from: "0xa", to: 0n, token_id: 42n },
        },
        { blockNumber: 700_000n, eventIndex: 1 },
      ),
    ).toMatchObject({ tokenId: "42", owner: null, burned: true });
  });

  it("decodes the raw Cairo ERC-721 Transfer key layout", () => {
    const decoded = decodeEvent({
      abi: REALMS_TRANSFER_ABI,
      eventName:
        "openzeppelin::token::erc721::erc721::ERC721Component::Transfer",
      event: {
        keys: [getSelector("Transfer"), "0x0", "0xa", "0x2a", "0x0"],
        data: [],
        transactionHash: "0xabc",
      } as never,
    });

    expect(
      toRealmTransfer(decoded, { blockNumber: 664_162n, eventIndex: 0 }),
    ).toMatchObject({ tokenId: "42", owner: "0xa", burned: false });
  });

  it(
    "keeps only the current owner and removes a burned Realm",
    async () => {
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
        CREATE TABLE starknet_realm_ownership_status (
          _id text PRIMARY KEY NOT NULL,
          latest_block_number numeric NOT NULL,
          latest_block_timestamp timestamp with time zone NOT NULL,
          last_processed_at timestamp with time zone NOT NULL,
          has_reached_head boolean DEFAULT false NOT NULL
        );
      `);
      const database = drizzle(client);

      await applyRealmTransfer(database, {
        tokenId: "42",
        owner: "0xa",
        blockNumber: "700000",
        transactionHash: "0x1",
        eventIndex: 0,
        burned: false,
      });
      await applyRealmTransfer(database, {
        tokenId: "42",
        owner: "0xb",
        blockNumber: "700001",
        transactionHash: "0x2",
        eventIndex: 2,
        burned: false,
      });

      expect(await database.select().from(starknetRealmOwnership)).toEqual([
        expect.objectContaining({
          _id: "42",
          token_id: "42",
          owner: "0xb",
          block_number: "700001",
          transaction_hash: "0x2",
          event_index: 2,
        }),
      ]);

      await applyRealmTransfer(database, {
        tokenId: "42",
        owner: null,
        blockNumber: "700002",
        transactionHash: "0x3",
        eventIndex: 0,
        burned: true,
      });

      expect(await database.select().from(starknetRealmOwnership)).toEqual([]);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "records initial sync separately from a checkpoint that reached the head",
    async () => {
      client = new PGlite();
      await client.exec(`
        CREATE TABLE starknet_realm_ownership_status (
          _id text PRIMARY KEY NOT NULL,
          latest_block_number numeric NOT NULL,
          latest_block_timestamp timestamp with time zone NOT NULL,
          last_processed_at timestamp with time zone NOT NULL,
          has_reached_head boolean DEFAULT false NOT NULL
        );
      `);
      const database = drizzle(client);
      const now = new Date("2026-08-21T10:00:00.000Z");

      await recordOwnershipProgress(database, {
        blockNumber: 664_162n,
        blockTimestamp: new Date("2023-01-01T00:00:00.000Z"),
        processedAt: now,
      });

      expect(
        await database.select().from(starknetRealmOwnershipStatus),
      ).toEqual([
        expect.objectContaining({
          latest_block_number: "664162",
          has_reached_head: false,
        }),
      ]);

      await recordOwnershipProgress(database, {
        blockNumber: 2_500_000n,
        blockTimestamp: new Date("2026-08-21T09:59:00.000Z"),
        processedAt: now,
      });

      expect(
        await database.select().from(starknetRealmOwnershipStatus),
      ).toEqual([
        expect.objectContaining({
          latest_block_number: "2500000",
          has_reached_head: true,
        }),
      ]);
    },
    TEST_TIMEOUT_MS,
  );
});
