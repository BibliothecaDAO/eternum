/**
 * Name uniqueness is case-insensitive; the unique index on lower(name) is the race-proof guarantee and this pre-check
 * only shapes the error. Format rules live in name-rules.ts.
 */
export const isNameTaken = async (db: D1Database, name: string, excludeUserId?: string): Promise<boolean> => {
  const { results } = await db
    .prepare('SELECT id FROM "user" WHERE lower(name) = lower(?) LIMIT 2')
    .bind(name)
    .all<{ id: string }>();
  return results.some((row) => row.id !== excludeUserId);
};
