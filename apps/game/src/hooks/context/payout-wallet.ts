/**
 * The account's payout wallet as the identity service reports it on the session (user.payoutWallet): none, linked and
 * held for 24 hours after a change, or ready to receive. Times are Unix milliseconds. One type for the account page
 * and the match. Every wallet change needs the emailed code; a session without a valid payout wallet is an identity
 * fault the account page shows, never a way back to an uncoded link.
 */
export type PayoutWallet =
  | { status: "no_wallet" }
  | { status: "on_hold"; address: string; until: number }
  | { status: "ready"; address: string };

export const payoutWalletOf = (user: object): PayoutWallet | null => {
  const wallet = (user as { payoutWallet?: unknown }).payoutWallet;
  return isPayoutWallet(wallet) ? wallet : null;
};

const isPayoutWallet = (value: unknown): value is PayoutWallet => {
  if (typeof value !== "object" || value === null) return false;
  const wallet = value as Record<string, unknown>;
  if (wallet.status === "no_wallet") return true;
  if (typeof wallet.address !== "string") return false;
  return wallet.status === "ready" || (wallet.status === "on_hold" && typeof wallet.until === "number");
};

const HOLD_MS = 24 * 60 * 60 * 1000;

/** How much of the hold has passed, for its ring: 0 when it starts, 1 when the wallet can receive. */
export const holdShare = (until: number, now: number): number => Math.min(1, Math.max(0, 1 - (until - now) / HOLD_MS));
