import { json } from "./http";

/**
 * How far the default wallet's backfill has come: verified accounts, those still without a payout wallet (each meets
 * the passkey prompt at its next visit), and those paid to their default wallet or to a wallet they linked.
 */
export async function handleWalletCounts(db: D1Database) {
  const counts = await db
    .prepare(
      `SELECT COUNT(*) AS accounts,
         SUM(u.address IS NULL) AS withoutWallet,
         SUM(d.address IS NOT NULL) AS paidToDefaultWallet,
         SUM(u.address IS NOT NULL AND d.address IS NULL) AS paidToLinkedWallet
       FROM "user" u LEFT JOIN default_wallets d ON d.address = u.address
       WHERE u."emailVerified" = 1`,
    )
    .first<Record<string, number | null>>();
  return json(Object.fromEntries(Object.entries(counts ?? {}).map(([name, value]) => [name, value ?? 0])));
}
