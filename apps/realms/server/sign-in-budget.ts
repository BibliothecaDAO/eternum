/** Sends and guesses consume one address-wide allowance, shared across isolates and edge locations. */
export async function consumeSignInBudget(db: D1Database, email: string): Promise<boolean> {
  const now = Date.now();
  const results = await db.batch([
    db.prepare("DELETE FROM sign_in_budget WHERE expires_at <= ?").bind(now),
    db
      .prepare(
        `INSERT INTO sign_in_budget (email, attempts, expires_at) VALUES (?, 1, ?)
      ON CONFLICT(email) DO UPDATE SET attempts = attempts + 1
      WHERE attempts < 30 RETURNING attempts`,
      )
      .bind(email, now + 24 * 60 * 60 * 1000),
  ]);
  return results[1]!.results.length === 1;
}
