import { StarknetStream, getSelector } from "@apibara/starknet";
import { defineIndexer } from "@apibara/indexer";
import { useLogger } from "@apibara/indexer/plugins";
import { drizzleStorage, useDrizzleStorage } from "@apibara/plugin-drizzle";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { ApibaraRuntimeConfig } from "apibara/types";
import type {
  ExtractTablesWithRelations,
  TablesRelationalConfig,
} from "drizzle-orm";
import { db } from "@realms-world/db/client";
import { hash } from "starknet";
import { ChainId, REALMS_BRIDGE_ADDRESS } from "@realms-world/constants";
import { env } from "../env";
// USDC Transfers on Starknet
export default function (runtimeConfig: ApibaraRuntimeConfig) {
  return createIndexer({ database: db });
}
const chainId = env.VITE_PUBLIC_CHAIN === 'sepolia' ? ChainId.SN_SEPOLIA : ChainId.SN_MAIN

export function createIndexer<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown> = Record<string, never>,
  TSchema extends
    TablesRelationalConfig = ExtractTablesWithRelations<TFullSchema>,
>({ database }: { database: PgDatabase<TQueryResult, TFullSchema, TSchema> }) {
  return defineIndexer(StarknetStream)({
    streamUrl: "https://starknet.preview.apibara.org",
    finality: "accepted",
    startingCursor: {
      orderKey: 10_30_000n,
    },
    filter: {
      events: [
        {
          address:
          REALMS_BRIDGE_ADDRESS[chainId] as `0x${string}`, //TODO add env
          keys: [
            getSelector(
              "WithdrawRequestCompleted"
            ) as `0x${string}`,
            getSelector(
              "DepositRequestInitiated"
            ) as `0x${string}`,
          ],
        },
      ],
    },
    plugins: [
      /*drizzleStorage({
        db: database,
        idColumn: "_id",
        persistState: true,
        indexerName: "starknet-usdc-transfers",
      }),*/
    ],
    async transform({ endCursor, block, context, finality }) {
      const logger = useLogger();
      //const { db } = useDrizzleStorage();
      const { events } = block;

      logger.info(
        "Transforming block | orderKey: ",
        endCursor?.orderKey,
        " | finality: ",
        finality,
      );
    }
  });
}
