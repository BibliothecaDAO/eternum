import pg from "pg";

import { REALM_OWNERSHIP_FRESHNESS_WINDOW_MS } from "../../db/src/realm-ownership-policy.mjs";
import {
  assertIndexedOwnership,
  parseOwnershipAssertion,
} from "./realm-ownership-smoke.mjs";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const assertion = parseOwnershipAssertion(
  process.env.REALM_OWNERSHIP_SMOKE_ADDRESS,
  process.env.REALM_OWNERSHIP_SMOKE_EXPECTED_COUNT,
);

try {
  const statusResult = await pool.query(`
    SELECT latest_block_number, latest_block_timestamp, last_processed_at, has_reached_head
    FROM starknet_realm_ownership_status
    WHERE _id = 'starknet-realms-ownership'
    LIMIT 1
  `);
  const status = statusResult.rows[0];
  if (!status) throw new Error("Realm ownership indexer has no checkpoint");
  const inventoryResult = await pool.query(
    "SELECT COUNT(*)::integer AS count FROM starknet_realm_ownership",
  );
  const indexedCount = inventoryResult.rows[0]?.count ?? 0;
  if (!status.has_reached_head) {
    throw new Error(
      `Realm ownership indexer is still performing its initial sync at block ${status.latest_block_number} (${new Date(status.latest_block_timestamp).toISOString()}); last processed ${new Date(status.last_processed_at).toISOString()}; ${indexedCount} current ownership records indexed`,
    );
  }

  const checkpointAgeMs =
    Date.now() - new Date(status.latest_block_timestamp).getTime();
  if (checkpointAgeMs > REALM_OWNERSHIP_FRESHNESS_WINDOW_MS) {
    throw new Error("Realm ownership indexer checkpoint is stale");
  }

  const countResult = await pool.query(
    "SELECT COUNT(*)::integer AS count FROM starknet_realm_ownership WHERE owner = $1",
    [assertion.owner],
  );
  const walletCount = countResult.rows[0]?.count ?? 0;
  assertIndexedOwnership(indexedCount, walletCount, assertion.expectedCount);

  console.log(
    `Realm ownership indexer healthy at block ${status.latest_block_number}; ${indexedCount} current ownership records indexed; ${assertion.owner} owns ${walletCount} indexed Realms`,
  );
} finally {
  await pool.end();
}
