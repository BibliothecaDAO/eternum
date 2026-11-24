import { RACE_CLAIM_WINDOW_SECONDS } from "../../../../packages/value-ledger/src/codecs";
import { PAYOUT_WALLET_CHANGE_SECONDS } from "../../../../packages/value-ledger/src/payout-wallet";

export const PAYOUT_WALLET = {
  changeHoldHours: PAYOUT_WALLET_CHANGE_SECONDS / 3600,
  claimWindowDays: RACE_CLAIM_WINDOW_SECONDS / 86400,
};
