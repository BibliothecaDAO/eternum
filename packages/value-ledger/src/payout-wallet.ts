/**
 * How long the box co-signer holds payouts to a payout wallet that replaced the account's known one, counted from the
 * first payout it is asked to sign to that wallet. An account's first wallet, and an unchanged one, are paid at once.
 * The co-signer enforces it; the app and the docs state it.
 */
export const PAYOUT_WALLET_CHANGE_SECONDS = 24 * 60 * 60;
