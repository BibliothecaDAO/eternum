import type { DefaultWallet } from "@realms-world/identity";
import { useEffect } from "react";
import { create } from "zustand";

import { identityClient, useIdentitySessionStore } from "./identity-session";

/** The signed-in account's default wallet, read once per account: whose it is, and the wallet (null: it has none). */
const useDefaultWalletStore = create<{ owner: string | null; wallet: DefaultWallet | null }>()(() => ({
  owner: null,
  wallet: null,
}));

let reading: string | null = null;

const readFor = async (realmsId: string) => {
  if (reading === realmsId) return;
  reading = realmsId;
  try {
    const wallet = await identityClient.readDefaultWallet();
    if (useIdentitySessionStore.getState().session?.user.realmsId === realmsId)
      useDefaultWalletStore.setState({ owner: realmsId, wallet });
  } catch (error) {
    // Unread, the account is shown as having none: its payouts still reach the linked address, and a send from it
    // asks for a connected wallet as before, rather than waiting on a read that failed.
    console.error("default_wallet_read_failed", error);
    if (useIdentitySessionStore.getState().session?.user.realmsId === realmsId)
      useDefaultWalletStore.setState({ owner: realmsId, wallet: null });
  } finally {
    reading = null;
  }
};

/** The account's wallet just made: every surface shows it at once, with no second read. */
export const noteDefaultWallet = (realmsId: string, wallet: DefaultWallet) =>
  useDefaultWalletStore.setState({ owner: realmsId, wallet });

/**
 * The signed-in account's default wallet: undefined while it is read, null when the account has none or no one is
 * signed in.
 * The address alone is in the session as the payout wallet; signing needs the passkey's id and key, which this holds.
 */
export const useDefaultWallet = (): DefaultWallet | null | undefined => {
  const realmsId = useIdentitySessionStore((state) => state.session?.user.realmsId ?? null);
  const { owner, wallet } = useDefaultWalletStore();
  useEffect(() => {
    if (realmsId && owner !== realmsId) void readFor(realmsId);
  }, [owner, realmsId]);
  if (realmsId === null) return null;
  return owner === realmsId ? wallet : undefined;
};
