import { Effect } from "effect";
import { resolvePayoutWallet, type PayoutWallet } from "@realms-world/identity";

/** Always read the current link, never the caller's session copy. */
export const lookupPayoutWallet = (
  db: D1Database,
  realmsId: string,
  now = Date.now(),
): Effect.Effect<PayoutWallet, Error> =>
  Effect.tryPromise({
    try: async () => {
      const user = await readLinkedWallet(db, realmsId);
      return user ? resolvePayoutWallet(user, now) : { status: "no_wallet" };
    },
    catch: () => new Error("payout_wallet_unavailable"),
  });

export const readLinkedWallet = (db: D1Database, realmsId: string) =>
  db
    .prepare('SELECT "address", "walletLinkedAt" FROM "user" WHERE "realmsId" = ?')
    .bind(realmsId)
    .first<{ address: string | null; walletLinkedAt: number | null }>();
