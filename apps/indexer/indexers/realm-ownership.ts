import type { ExtractTablesWithRelations, TablesRelationalConfig } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { eq, sql } from "drizzle-orm";

import { REALM_OWNERSHIP_FRESHNESS_WINDOW_MS } from "@realms-world/db";
import {
  REALM_OWNERSHIP_INDEXER_ID,
  starknetRealmOwnership,
  starknetRealmOwnershipStatus,
} from "@realms-world/db/schema";

import { toDecimalAmount } from "./amount-utils";

export { REALM_OWNERSHIP_INDEXER_ID } from "@realms-world/db/schema";

type NumericValue = bigint | number | string;

interface DecodedTransfer {
  transactionHash: string;
  args: {
    from: unknown;
    to: unknown;
    token_id: unknown;
  };
}

export interface RealmTransfer {
  tokenId: string;
  owner: string | null;
  blockNumber: string;
  transactionHash: string;
  eventIndex: number;
  burned: boolean;
}

interface ProgressUpdate {
  blockNumber: bigint;
  blockTimestamp: Date;
  processedAt?: Date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseNumericValue(value: unknown, field: string): bigint {
  if (typeof value !== "bigint" && typeof value !== "number" && typeof value !== "string") {
    throw new TypeError(`Invalid ${field}`);
  }

  try {
    return BigInt(value as NumericValue);
  } catch {
    throw new TypeError(`Invalid ${field}`);
  }
}

function normalizeStarknetAddress(value: unknown): string {
  const address = parseNumericValue(value, "Starknet address");
  if (address < 0n || address >= 2n ** 251n - 256n) {
    throw new RangeError(`Invalid Starknet address: ${String(value)}`);
  }
  return `0x${address.toString(16)}`;
}

function parseDecodedTransfer(value: unknown): DecodedTransfer {
  if (!isRecord(value) || typeof value.transactionHash !== "string") {
    throw new TypeError("Invalid decoded Transfer event");
  }
  const args = value.args;
  if (!isRecord(args) || !("from" in args) || !("to" in args) || !("token_id" in args)) {
    throw new TypeError("Invalid decoded Transfer event args");
  }
  return {
    transactionHash: value.transactionHash,
    args: {
      from: args.from,
      to: args.to,
      token_id: args.token_id,
    },
  };
}

export function toRealmTransfer(
  decodedValue: unknown,
  location: { blockNumber: bigint; eventIndex: number },
): RealmTransfer {
  const decoded = parseDecodedTransfer(decodedValue);
  const to = parseNumericValue(decoded.args.to, "Transfer recipient");

  return {
    tokenId: toDecimalAmount(decoded.args.token_id),
    owner: to === 0n ? null : normalizeStarknetAddress(to),
    blockNumber: location.blockNumber.toString(),
    transactionHash: decoded.transactionHash,
    eventIndex: location.eventIndex,
    burned: to === 0n,
  };
}

export async function applyRealmTransfer<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown> = Record<string, never>,
  TSchema extends TablesRelationalConfig = ExtractTablesWithRelations<TFullSchema>,
>(database: PgDatabase<TQueryResult, TFullSchema, TSchema>, transfer: RealmTransfer) {
  if (transfer.burned) {
    await database.delete(starknetRealmOwnership).where(eq(starknetRealmOwnership._id, transfer.tokenId));
    return;
  }

  if (!transfer.owner) {
    throw new Error("A non-burn transfer must have an owner");
  }

  const values = {
    _id: transfer.tokenId,
    token_id: transfer.tokenId,
    owner: transfer.owner,
    block_number: transfer.blockNumber,
    transaction_hash: transfer.transactionHash,
    event_index: transfer.eventIndex,
  };

  await database
    .insert(starknetRealmOwnership)
    .values(values)
    .onConflictDoUpdate({
      target: starknetRealmOwnership._id,
      set: {
        owner: values.owner,
        block_number: values.block_number,
        transaction_hash: values.transaction_hash,
        event_index: values.event_index,
      },
    });
}

export async function recordOwnershipProgress<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown> = Record<string, never>,
  TSchema extends TablesRelationalConfig = ExtractTablesWithRelations<TFullSchema>,
>(database: PgDatabase<TQueryResult, TFullSchema, TSchema>, update: ProgressUpdate) {
  const processedAt = update.processedAt ?? new Date();
  const hasReachedHead =
    Math.abs(processedAt.getTime() - update.blockTimestamp.getTime()) <= REALM_OWNERSHIP_FRESHNESS_WINDOW_MS;

  await database
    .insert(starknetRealmOwnershipStatus)
    .values({
      _id: REALM_OWNERSHIP_INDEXER_ID,
      latest_block_number: update.blockNumber.toString(),
      latest_block_timestamp: update.blockTimestamp,
      last_processed_at: processedAt,
      has_reached_head: hasReachedHead,
    })
    .onConflictDoUpdate({
      target: starknetRealmOwnershipStatus._id,
      set: {
        latest_block_number: update.blockNumber.toString(),
        latest_block_timestamp: update.blockTimestamp,
        last_processed_at: processedAt,
        has_reached_head: sql`${starknetRealmOwnershipStatus.has_reached_head} OR ${hasReachedHead}`,
      },
    });
}
