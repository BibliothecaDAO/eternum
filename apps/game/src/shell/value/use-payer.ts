import { useDefaultWallet } from "@/hooks/context/default-wallet";
import { useIdentitySession } from "@/hooks/context/identity-session";
import { payoutAddressOf } from "@/hooks/context/payout-wallet";

export const usePayer = () => {
  const { session } = useIdentitySession();
  const { wallet, failed, retry } = useDefaultWallet();
  const payer =
    wallet === undefined ? undefined : (wallet?.address ?? (session ? payoutAddressOf(session.user) : null));
  return { payer, passkey: Boolean(wallet), failed, retry };
};
