import { PAYOUT_WALLET_CHANGE_SECONDS } from "../../../../packages/value-ledger/src/payout-wallet";

/** The payout wallet's rules as its page states them: the co-signer's hold on a replaced wallet, in hours. */
export const PAYOUT_WALLET = { changeHoldHours: PAYOUT_WALLET_CHANGE_SECONDS / 3600 };
