/** Always read the current link, never the caller's session copy. */
export const readLinkedWallet = (db: D1Database, realmsId: string) =>
  db.prepare('SELECT "address" FROM "user" WHERE "realmsId" = ?').bind(realmsId).first<{ address: string | null }>();
