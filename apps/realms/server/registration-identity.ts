import { normalizeStarknetAddress } from "@realms-world/identity";

/** Registration spends value; its link need not have passed the receiving hold. */
export async function registrationRealmsId(
  db: D1Database,
  wallet: string,
  registeredAt: number,
): Promise<string | null> {
  if (!Number.isSafeInteger(registeredAt) || registeredAt < 0 || !Number.isSafeInteger(registeredAt * 1000))
    throw new Error("invalid_registration_time");
  const { results } = await db
    .prepare(
      "SELECT account FROM wallet_link_history WHERE wallet=?1 AND linked_at<=?2 AND (replaced_at IS NULL OR ?2<replaced_at) ORDER BY linked_at DESC, rowid DESC LIMIT 1",
    )
    .bind(normalizeStarknetAddress(wallet), registeredAt * 1000)
    .all<{ account: string }>();
  return results[0]?.account ?? null;
}
