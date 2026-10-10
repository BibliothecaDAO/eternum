/** The allowance expires with one live challenge; a stranger cannot lock out an email for a day. */
export async function consumeChallengeAttempt(db: D1Database, identifier: string): Promise<boolean> {
  const challenge = await db
    .prepare(
      "SELECT value, expiresAt FROM verification WHERE identifier=? AND julianday(expiresAt)>julianday('now') ORDER BY createdAt DESC LIMIT 1",
    )
    .bind(identifier)
    .first<{ value: string; expiresAt: string }>();
  if (!challenge) return false;
  const hash = challenge.value.split(":")[0]!;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${identifier}\n${hash}\n${challenge.expiresAt}`),
  );
  const id = `otp-attempts-${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  const live =
    "identifier=?1 AND (value=?2 OR substr(value,1,length(?2)+1)=?2||':') AND julianday(expiresAt)=julianday(?3) AND julianday(expiresAt)>julianday('now')";
  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO verification(id,identifier,value,expiresAt,createdAt,updatedAt) SELECT ?4,?4,'0',expiresAt,datetime('now'),datetime('now') FROM verification WHERE ${live} LIMIT 1 ON CONFLICT(id) DO NOTHING`,
      )
      .bind(identifier, hash, challenge.expiresAt, id),
    db
      .prepare(
        `UPDATE verification SET value=CAST(value AS INTEGER)+1 WHERE id=?4 AND CAST(value AS INTEGER)<3 AND EXISTS(SELECT 1 FROM verification WHERE ${live}) RETURNING id`,
      )
      .bind(identifier, hash, challenge.expiresAt, id),
  ]);
  return results[1]!.results.length === 1;
}
