/**
 * The gameplay accounts the guardian approved a device for, by address. An account can act on a shard only after its
 * first device is approved, so every account a story can name is here: this is the way from a story's recipient back
 * to the Realms account whose devices receive the alert.
 */
export const recordApprovedAccount = async (db: D1Database, address: string, realmsId: string): Promise<void> => {
  await db
    .prepare('INSERT INTO "realms_accounts" ("address", "realmsId") VALUES (?, ?) ON CONFLICT DO NOTHING')
    .bind(normalizeAddress(address), realmsId)
    .run();
};

/** The Realms account behind each of these gameplay account addresses; unknown addresses are absent. */
export const realmsIdsOfAccounts = async (
  db: D1Database,
  addresses: readonly string[],
): Promise<Map<string, string>> => {
  if (addresses.length === 0) return new Map();
  const { results } = await db
    .prepare(
      `SELECT "address", "realmsId" FROM "realms_accounts" WHERE "address" IN (${addresses.map(() => "?").join(", ")})`,
    )
    .bind(...addresses.map(normalizeAddress))
    .all<{ address: string; realmsId: string }>();
  return new Map(results.map((row) => [row.address, row.realmsId]));
};

const normalizeAddress = (address: string) => `0x${BigInt(address).toString(16)}`;
