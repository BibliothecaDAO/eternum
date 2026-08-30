import type { ExtractTablesWithRelations, TablesRelationalConfig } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Abi } from "starknet";
import { defineIndexer } from "@apibara/indexer";
import { useLogger as getLogger } from "@apibara/indexer/plugins";
import { drizzleStorage, useDrizzleStorage as getDrizzleStorage } from "@apibara/plugin-drizzle";
import { decodeEvent, getSelector, StarknetStream } from "@apibara/starknet";

import { valuePlaneAddress } from "@realms-world/chain";
import { db } from "@realms-world/db/client";
import { starknet_mmr_updates } from "@realms-world/db/schema";
import { normalizeStarknetAddress } from "@realms-world/identity";

import { getStarknetStreamUrl } from "../streams";

const MMR_UPDATED_SELECTOR = getSelector("MMRUpdated");

// The MMRToken lives on mainnet only (value-plane design §0); scanning starts at
// its deployment era. Override with MMR_INDEXER_START_BLOCK for a full rescan —
// rows are keyed by (transaction_hash, event_index), so replays are idempotent.
const DEFAULT_START_BLOCK = 0n;

const startingBlock = (): bigint => {
  const raw = process.env.MMR_INDEXER_START_BLOCK;
  if (raw === undefined || raw === "") return DEFAULT_START_BLOCK;
  return BigInt(raw);
};

export default function () {
  return createIndexer({ database: db });
}

export function createIndexer<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown> = Record<string, never>,
  TSchema extends TablesRelationalConfig = ExtractTablesWithRelations<TFullSchema>,
>({ database }: { database: PgDatabase<TQueryResult, TFullSchema, TSchema> }) {
  return defineIndexer(StarknetStream)({
    streamUrl: getStarknetStreamUrl("mainnet"),
    finality: "accepted",
    startingCursor: { orderKey: startingBlock() },
    filter: {
      events: [
        {
          address: valuePlaneAddress("mmrToken") as `0x${string}`,
          keys: [MMR_UPDATED_SELECTOR],
        },
      ],
    },
    plugins: [
      drizzleStorage({
        db: database,
        schema: { starknet_mmr_updates },
        persistState: true,
        indexerName: "starknet-mmr-updates",
      }),
    ],
    async transform({ block }) {
      const logger = getLogger();
      const { db: storage } = getDrizzleStorage();

      for (const event of block.events) {
        const { args, transactionHash } = decodeEvent({
          abi: MMR_TOKEN_ABI,
          eventName: "MMRUpdated",
          event,
        });

        await storage
          .insert(starknet_mmr_updates)
          .values({
            player: normalizeStarknetAddress(args.player as string | bigint),
            new_mmr: args.new_mmr.toString(),
            transaction_hash: transactionHash,
            event_index: event.eventIndex,
            block_number: Number(block.header.blockNumber),
            timestamp: block.header.timestamp,
          })
          .onConflictDoNothing();
      }

      if (block.events.length > 0) {
        logger.info(`Indexed ${block.events.length} MMRUpdated event(s) at Starknet block ${block.header.blockNumber}`);
      }
    },
  });
}

export const MMR_TOKEN_ABI = [
  {
    kind: "struct",
    name: "MMRUpdated",
    type: "event",
    members: [
      {
        kind: "key",
        name: "player",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        kind: "data",
        name: "old_mmr",
        type: "core::integer::u256",
      },
      {
        kind: "data",
        name: "new_mmr",
        type: "core::integer::u256",
      },
      {
        kind: "data",
        name: "timestamp",
        type: "core::integer::u64",
      },
    ],
  },
] as const satisfies Abi;
