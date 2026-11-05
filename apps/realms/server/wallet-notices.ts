import { payoutWalletEmail, walletRecoveryEmail } from "@bibliothecadao/notifications";
import { sendIdentityEmail } from "./sign-in-codes";
import type { SendWalletNotice } from "./wallet-changes";

/** A queued notice as its email: the payout wallet's change, or a recovery of the default wallet at `address`. */
export const resendWalletNotices =
  (apiKey: string, appUrl: string): SendWalletNotice =>
  (email, address, id, kind) => {
    if (kind === "payout")
      return sendIdentityEmail(apiKey, payoutWalletEmail({ to: email, address, appUrl, idempotencyKey: id }));
    // Thrown, the notice stays queued and its failure is logged at each retry.
    if (address === null) throw new Error("recovery_notice_without_wallet");
    return sendIdentityEmail(apiKey, walletRecoveryEmail({ to: email, wallet: address, appUrl, idempotencyKey: id }));
  };
