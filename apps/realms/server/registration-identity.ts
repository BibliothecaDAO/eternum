import { normalizeStarknetAddress } from "@realms-world/identity";
import type { SlotRegistration } from "@realms-world/value-ledger";

/** Registration spends value; its link need not have passed the receiving hold. */
export async function registrationRealmsIds(
  db: D1Database,
  registrations: readonly SlotRegistration[],
): Promise<(string | null)[]> {
  if (registrations.length > 100) throw new Error("registration_identity_page_too_large");
  const page = registrations.map(({ wallet, registeredAt }) => {
    if (!Number.isSafeInteger(registeredAt) || registeredAt < 0 || !Number.isSafeInteger(registeredAt * 1000))
      throw new Error("invalid_registration_time");
    return { wallet: normalizeStarknetAddress(wallet), at: registeredAt * 1000 };
  });
  const { results } = await db
    .prepare(
      `
    SELECT (
      SELECT account FROM wallet_link_history
      WHERE wallet=json_extract(entry.value,'$.wallet')
      AND linked_at<=json_extract(entry.value,'$.at')
      AND (replaced_at IS NULL OR json_extract(entry.value,'$.at')<replaced_at)
      ORDER BY linked_at DESC, rowid DESC LIMIT 1
    ) AS account FROM json_each(?1) AS entry ORDER BY CAST(entry.key AS INTEGER)
  `,
    )
    .bind(JSON.stringify(page))
    .all<{ account: string | null }>();
  return results.map(({ account }) => account);
}
