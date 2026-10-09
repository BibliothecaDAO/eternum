/**
 * The account's payout wallet as the identity session states it (GET /api/auth/get-session, `user.payoutWallet`, times
 * in Unix milliseconds): none linked, linked but still in its 24-hour hold, or ready to receive.
 */
export type PayoutWallet =
  | { status: "no_wallet" }
  | { status: "on_hold"; address: string; until: number }
  | { status: "ready"; address: string };
