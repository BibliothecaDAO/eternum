//import type { ApibaraRuntimeConfig } from "apibara/types";
import type {
  ExtractTablesWithRelations,
  TablesRelationalConfig,
} from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Abi } from "starknet";
import { defineIndexer } from "@apibara/indexer";
import { useLogger } from "@apibara/indexer/plugins";
import { drizzleStorage, useDrizzleStorage } from "@apibara/plugin-drizzle";
import { decodeEvent, getSelector, StarknetStream } from "@apibara/starknet";

import { ChainId, CollectionAddresses } from "@realms-world/constants";
import { db } from "@realms-world/db/poolClient";
import { realmsLordsClaims } from "@realms-world/db/schema";

import { env } from "../env";
import { REALMS_ABI } from "./strk-realms-lords-claims.indexer";

export default function (/*runtimeConfig: ApibaraRuntimeConfig*/) {
  return createIndexer({ database: db });
}
const chainId =
  env.VITE_PUBLIC_CHAIN === "sepolia" ? ChainId.SEPOLIA : ChainId.MAINNET;
const l2ChainId =
  env.VITE_PUBLIC_CHAIN === "sepolia" ? ChainId.SN_SEPOLIA : ChainId.SN_MAIN;

export function createIndexer<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown> = Record<string, never>,
  TSchema extends
    TablesRelationalConfig = ExtractTablesWithRelations<TFullSchema>,
>({ database }: { database: PgDatabase<TQueryResult, TFullSchema, TSchema> }) {
  return defineIndexer(StarknetStream)({
    streamUrl:
      env.VITE_PUBLIC_CHAIN === "sepolia"
        ? "https://starknet-sepolia.preview.apibara.org"
        : "https://starknet.preview.apibara.org",

    finality: "pending",
    startingCursor: {
      orderKey: env.VITE_PUBLIC_CHAIN === "sepolia" ? 76_103n : 664_161n,
    },
    filter: {
      events: [
        {
          address: CollectionAddresses.realms[l2ChainId] as `0x${string}`,
          keys: [getSelector("DelegateChanged")],
        },
        {
          address: CollectionAddresses.realms[l2ChainId] as `0x${string}`,
          keys: [getSelector("DelegateVotesChanged")],
        },
      ],
    },
    plugins: [
      drizzleStorage({
        db: database,
        idColumn: "_id",
        persistState: true,
        indexerName: "starknet-delegates",
      }),
    ],
    async transform({ endCursor, block, finality }) {
      const logger = useLogger();
      const { db } = useDrizzleStorage();
      const { events } = block;

      logger.info(
        "Transforming block | orderKey: ",
        endCursor?.orderKey,
        " | finality: ",
        finality,
      );

      for (const event of events) {
        if (event.keys[0] === getSelector("DelegateVotesChanged")) {
          const { args, transactionHash } = decodeEvent({
            abi: REALMS_ABI,
            eventName:
              "strealm::components::erc721::extensions::erc721_votes::ERC721VotesComponent::DelegateVotesChanged",
            event,
          });

          console.log(args);

          /* await db
            .insert(realmsLordsClaims)
            .values({
              hash: transactionHash,
              recipient: args.recipient,
              amount: args.amount,
              timestamp: block.header.timestamp,
            })
            .onConflictDoNothing();*/
        } else if (event.keys[0] === getSelector("DelegateChanged")) {
          const { args, transactionHash } = decodeEvent({
            abi: REALMS_ABI,
            eventName:
              "strealm::components::erc721::extensions::erc721_votes::ERC721VotesComponent::DelegateChanged",
            event,
          });

          /*await db
            .insert(realmsLordsClaims)
            .values({
              hash: transactionHash,
              recipient: args.recipient,
              amount: args.amount,
              timestamp: block.header.timestamp,
            })
            .onConflictDoNothing();*/
        }
      }
    },
  });
}
