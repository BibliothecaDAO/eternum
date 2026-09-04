import type { ExtractTablesWithRelations, TablesRelationalConfig } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { defineIndexer } from "@apibara/indexer";
import { useLogger as getLogger } from "@apibara/indexer/plugins";
import { drizzleStorage, useDrizzleStorage as getDrizzleStorage } from "@apibara/plugin-drizzle";
import { decodeEvent, getSelector, StarknetStream } from "@apibara/starknet";

import { ChainId, CollectionAddresses } from "@realms-world/chain";
import { db } from "@realms-world/db/client";

import { env } from "../env";
import { getStarknetStreamUrl } from "../streams";
import {
  applyRealmTransfer,
  REALM_OWNERSHIP_INDEXER_ID,
  recordOwnershipProgress,
  toRealmTransfer,
} from "./realm-ownership";
import { REALMS_TRANSFER_ABI } from "./realms-transfer-abi";

const TRANSFER_SELECTOR = getSelector("Transfer");
const FIRST_MAINNET_REALMS_EVENT_BLOCK = 664_162n;

function getOwnershipStorageSchema<TSchema extends TablesRelationalConfig>(
  schema: TSchema | undefined,
): TablesRelationalConfig {
  const ownership = schema?.starknetRealmOwnership;
  const status = schema?.starknetRealmOwnershipStatus;

  if (!ownership || !status) {
    throw new Error("Realm ownership tables are missing from the database schema");
  }

  return {
    starknetRealmOwnership: ownership,
    starknetRealmOwnershipStatus: status,
  };
}

export default function () {
  return createIndexer({ database: db });
}

export function createIndexer<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown> = Record<string, never>,
  TSchema extends TablesRelationalConfig = ExtractTablesWithRelations<TFullSchema>,
>({ database }: { database: PgDatabase<TQueryResult, TFullSchema, TSchema> }) {
  const l2ChainId = env.VITE_PUBLIC_CHAIN === "sepolia" ? ChainId.SN_SEPOLIA : ChainId.SN_MAIN;

  return defineIndexer(StarknetStream)({
    streamUrl: getStarknetStreamUrl(env.VITE_PUBLIC_CHAIN),
    finality: "pending",
    startingCursor: {
      orderKey: env.VITE_PUBLIC_CHAIN === "sepolia" ? 0n : FIRST_MAINNET_REALMS_EVENT_BLOCK - 1n,
    },
    filter: {
      header: "on_data_or_on_new_block",
      events: [
        {
          address: CollectionAddresses.realms[l2ChainId] as `0x${string}`,
          keys: [TRANSFER_SELECTOR],
        },
      ],
    },
    plugins: [
      drizzleStorage({
        db: database,
        schema: getOwnershipStorageSchema(database._.schema),
        idColumn: "_id",
        persistState: true,
        indexerName: REALM_OWNERSHIP_INDEXER_ID,
      }),
    ],
    async transform({ block }) {
      const logger = getLogger();
      const { db: storage } = getDrizzleStorage();

      for (const event of block.events) {
        const transfer = toRealmTransfer(
          decodeEvent({
            abi: REALMS_TRANSFER_ABI,
            eventName: "openzeppelin::token::erc721::erc721::ERC721Component::Transfer",
            event,
          }),
          {
            blockNumber: block.header.blockNumber,
            eventIndex: event.eventIndex,
          },
        );
        await applyRealmTransfer(storage, transfer);
      }

      await recordOwnershipProgress(storage, {
        blockNumber: block.header.blockNumber,
        blockTimestamp: block.header.timestamp,
      });

      if (block.events.length > 0) {
        logger.info(
          `Indexed ${block.events.length} Realm ownership transfer(s) at Starknet block ${block.header.blockNumber}`,
        );
      }
    },
  });
}
