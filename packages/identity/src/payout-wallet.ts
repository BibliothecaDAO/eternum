/** Times are Unix milliseconds. The same decision is used by the account endpoint and the value relay. */
export type PayoutWallet =
  | { status: "no_wallet" }
  | { status: "on_hold"; address: string; until: number }
  | { status: "ready"; address: string };

const WALLET_HOLD_MS = 24 * 60 * 60 * 1000;

export const resolvePayoutWallet = (
  user: { address: string | null; walletLinkedAt: number | null },
  now: number,
): PayoutWallet => {
  if (!user.address) return { status: "no_wallet" };
  if (user.walletLinkedAt === null || !Number.isSafeInteger(user.walletLinkedAt) || user.walletLinkedAt < 0) {
    throw new Error("Linked payout wallet has no valid link time");
  }
  const until = user.walletLinkedAt + WALLET_HOLD_MS;
  return now < until ? { status: "on_hold", address: user.address, until } : { status: "ready", address: user.address };
};
