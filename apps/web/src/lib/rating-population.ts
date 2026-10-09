import { sql } from "@realms-world/db";
import { db } from "@realms-world/db/client";
import { MMR_HISTORY_CHECKPOINT_ID } from "@realms-world/db/schema";

/** One Postgres statement observes both canonical history and its commit watermark; it never returns current ratings. */
export async function readRatingPopulation() {
  const result = await db.execute(sql`
    WITH checkpoint AS (
      SELECT order_key, unique_key FROM airfoil.checkpoints WHERE id=${MMR_HISTORY_CHECKPOINT_ID}
    )
    SELECT c.order_key AS block_number,c.unique_key AS block_hash,
      ARRAY(SELECT DISTINCT player FROM starknet_mmr_updates WHERE block_number<=c.order_key ORDER BY player) AS players
    FROM checkpoint c
  `);
  const row = result.rows[0] as { block_number?: unknown; block_hash?: unknown; players?: unknown } | undefined;
  if (
    !row ||
    !Number.isSafeInteger(row.block_number) ||
    Number(row.block_number) < 0 ||
    typeof row.block_hash !== "string" ||
    !/^0x[0-9a-fA-F]{1,64}$/.test(row.block_hash) ||
    BigInt(row.block_hash) <= 0n ||
    !Array.isArray(row.players) ||
    !row.players.every(
      (player) =>
        typeof player === "string" &&
        /^0x[0-9a-fA-F]{1,64}$/.test(player) &&
        BigInt(player) > 0n &&
        BigInt(player) < (1n << 251n) - 256n,
    )
  )
    throw new Error("MMR history watermark unavailable");
  return {
    block_number: Number(row.block_number),
    block_hash: `0x${BigInt(row.block_hash).toString(16)}`,
    players: [...new Set(row.players.map((player) => `0x${BigInt(player).toString(16)}`))],
  };
}

export async function readRatingHistoryHead() {
  const result = await db.execute(
    sql`SELECT order_key AS block_number,unique_key AS block_hash FROM airfoil.checkpoints WHERE id=${MMR_HISTORY_CHECKPOINT_ID}`,
  );
  const row = result.rows[0] as { block_number?: unknown; block_hash?: unknown } | undefined;
  if (
    !row ||
    !Number.isSafeInteger(row.block_number) ||
    Number(row.block_number) < 0 ||
    typeof row.block_hash !== "string" ||
    !/^0x[0-9a-fA-F]{1,64}$/.test(row.block_hash) ||
    BigInt(row.block_hash) <= 0n
  )
    throw new Error("MMR history watermark unavailable");
  return { block_number: Number(row.block_number), block_hash: `0x${BigInt(row.block_hash).toString(16)}` };
}
