import { payoutWalletEmail } from "@bibliothecadao/notifications";
import { sendIdentityEmail } from "./sign-in-codes";

/** The payout wallet notice; the notice's id is its idempotency key, so a retried delivery sends it once. */
export const resendWalletNotices =
  (apiKey: string, appUrl: string) => (email: string, address: string | null, id: string) =>
    sendIdentityEmail(apiKey, payoutWalletEmail({ to: email, address, appUrl, idempotencyKey: id }));
