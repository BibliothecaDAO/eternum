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

/** Historical eligibility is an interval, so later replacement or unlink cannot rewrite a completed payment. */
export const wasReadyPayoutWallet = async (
  db: D1Database,
  account: string,
  wallet: string,
  at: number,
): Promise<boolean> => {
  if (!Number.isSafeInteger(at) || at < 0 || !Number.isSafeInteger(at * 1000)) throw new Error("invalid_payment_time");
  const history = await db
    .prepare(
      "SELECT wallet FROM wallet_link_history WHERE account=? AND ready_at<=? AND (replaced_at IS NULL OR replaced_at>?)",
    )
    .bind(account, at * 1000, at * 1000)
    .all<{ wallet: string }>();
  return history.results.some((row) => BigInt(row.wallet) === BigInt(wallet));
};
