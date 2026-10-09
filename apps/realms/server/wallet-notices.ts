import { sendIdentityEmail } from "./sign-in-codes";

export const resendWalletNotices = (apiKey: string) => (email: string, address: string | null, id: string) =>
  sendIdentityEmail(
    apiKey,
    email,
    "Your Realms payout wallet changed",
    address === null
      ? "Your Realms payout wallet was unlinked. If you did not make this change, sign in and secure your account."
      : `Your Realms payout wallet is now ${address}. If you did not make this change, sign in and secure your account.`,
    id,
  );
