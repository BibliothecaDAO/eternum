//import type { ApibaraRuntimeConfig } from "apibara/types";
import type { ExtractTablesWithRelations, TablesRelationalConfig } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Abi } from "starknet";
import { defineIndexer } from "@apibara/indexer";
import { useLogger as getLogger } from "@apibara/indexer/plugins";
import { drizzleStorage, useDrizzleStorage as getDrizzleStorage } from "@apibara/plugin-drizzle";
import { decodeEvent, getSelector, StarknetStream } from "@apibara/starknet";

import { ChainId, LORDS, StakingAddresses } from "@realms-world/chain";
import { db } from "@realms-world/db/poolClient";
import { velords_burner_transfers } from "@realms-world/db/schema";

import { env } from "../env";
import { getStarknetStreamUrl } from "../streams";
import { toDecimalAmount } from "./amount-utils";

export default function (/*runtimeConfig: ApibaraRuntimeConfig*/) {
  return createIndexer({ database: db });
}
const l2ChainId = env.VITE_PUBLIC_CHAIN === "sepolia" ? ChainId.SN_SEPOLIA : ChainId.SN_MAIN;

export function createIndexer<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown> = Record<string, never>,
  TSchema extends TablesRelationalConfig = ExtractTablesWithRelations<TFullSchema>,
>({ database }: { database: PgDatabase<TQueryResult, TFullSchema, TSchema> }) {
  return defineIndexer(StarknetStream)({
    streamUrl: getStarknetStreamUrl(env.VITE_PUBLIC_CHAIN),

    finality: "pending",
    startingCursor: {
      orderKey: env.VITE_PUBLIC_CHAIN === "sepolia" ? 76_103n : 714_904n,
    },
    filter: {
      events: [
        {
          address: LORDS[l2ChainId]?.address as `0x${string}`,
          keys: [getSelector("Transfer")],
        },
      ],
    },
    plugins: [
      drizzleStorage({
        db: database,
        schema: { velords_burner_transfers },
        idColumn: "_id",
        persistState: true,
        indexerName: "starknet-realms-lords-claims",
      }),
    ],
    async transform({ endCursor, block, finality }) {
      const logger = getLogger();
      const { db } = getDrizzleStorage();
      const { events } = block;

      logger.info("Transforming block | orderKey: ", endCursor?.orderKey, " | finality: ", finality);

      for (const event of events) {
        const { args, transactionHash } = decodeEvent({
          abi: LORDS_ABI,
          eventName: "Transfer",
          event,
        });

        if (args.to == StakingAddresses.velordsburner[l2ChainId]) {
          await db
            .insert(velords_burner_transfers)
            .values({
              transaction_hash: transactionHash,
              sender: args.from.toString(),
              amount: toDecimalAmount(args.value),
              timestamp: block.header.timestamp,
            })
            .onConflictDoNothing();
        }
      }
    },
  });
}

export const LORDS_ABI = [
  {
    kind: "struct",
    name: "Transfer",
    type: "event",
    members: [
      {
        kind: "data",
        name: "from",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        kind: "data",
        name: "to",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        kind: "data",
        name: "value",
        type: "core::integer::u256",
      },
    ],
  },
  {
    kind: "struct",
    name: "Approval",
    type: "event",
    members: [
      {
        kind: "key",
        name: "owner",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        kind: "key",
        name: "spender",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        kind: "key",
        name: "value",
        type: "core::integer::u256",
      },
    ],
  },
] as const satisfies Abi;
