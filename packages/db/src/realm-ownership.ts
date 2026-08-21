import type {
  ExtractTablesWithRelations,
  TablesRelationalConfig,
} from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { asc, eq } from "drizzle-orm";

import { REALM_OWNERSHIP_FRESHNESS_WINDOW_MS } from "./realm-ownership-policy.mjs";
import {
  REALM_OWNERSHIP_INDEXER_ID,
  starknetRealmMetadata,
  starknetRealmOwnership,
  starknetRealmOwnershipStatus,
} from "./schema/realm-ownership";

export type RealmOwnershipInventoryStatus =
  | "ready"
  | "syncing"
  | "stale"
  | "unavailable";

export interface RealmOwnershipToken {
  token_id: string;
  owner: string;
  metadata: string | null;
}

export interface RealmOwnershipInventory {
  status: RealmOwnershipInventoryStatus;
  tokens: RealmOwnershipToken[];
  checkpoint: {
    blockNumber: string;
    blockTimestamp: string;
  } | null;
}

export function normalizeRealmOwnerAddress(address: string): string {
  let value: bigint;
  try {
    value = BigInt(address);
  } catch {
    throw new Error("Invalid Starknet wallet address");
  }

  if (value <= 0n || value >= 2n ** 251n - 256n) {
    throw new Error("Invalid Starknet wallet address");
  }

  return `0x${value.toString(16)}`;
}

export async function getRealmOwnershipInventory<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown> = Record<string, never>,
  TSchema extends TablesRelationalConfig =
    ExtractTablesWithRelations<TFullSchema>,
>(
  database: PgDatabase<TQueryResult, TFullSchema, TSchema>,
  owner: string,
  now = new Date(),
): Promise<RealmOwnershipInventory> {
  const checkpointRows = await database
    .select()
    .from(starknetRealmOwnershipStatus)
    .where(eq(starknetRealmOwnershipStatus._id, REALM_OWNERSHIP_INDEXER_ID))
    .limit(1);
  const checkpointRow = checkpointRows.at(0);

  if (!checkpointRow) {
    return { status: "unavailable", tokens: [], checkpoint: null };
  }

  const checkpoint = {
    blockNumber: checkpointRow.latest_block_number,
    blockTimestamp: checkpointRow.latest_block_timestamp.toISOString(),
  };

  if (!checkpointRow.has_reached_head) {
    return { status: "syncing", tokens: [], checkpoint };
  }

  if (
    now.getTime() - checkpointRow.latest_block_timestamp.getTime() >
    REALM_OWNERSHIP_FRESHNESS_WINDOW_MS
  ) {
    return { status: "stale", tokens: [], checkpoint };
  }

  const rows = await database
    .select({
      token_id: starknetRealmOwnership.token_id,
      owner: starknetRealmOwnership.owner,
      metadata: starknetRealmMetadata.metadata,
    })
    .from(starknetRealmOwnership)
    .leftJoin(
      starknetRealmMetadata,
      eq(starknetRealmMetadata._id, starknetRealmOwnership._id),
    )
    .where(eq(starknetRealmOwnership.owner, owner))
    .orderBy(asc(starknetRealmOwnership.token_id));

  return { status: "ready", tokens: rows, checkpoint };
}
