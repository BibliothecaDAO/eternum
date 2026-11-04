import type { DefaultWallet } from "@realms-world/identity";
import { useCallback, useEffect } from "react";
import { create } from "zustand";

import { identityClient, useIdentitySessionStore } from "./identity-session";

/** What this page knows of an account's default wallet: not read yet, its read failed, or read (null: it has none). */
type WalletRead = { kind: "unread" } | { kind: "failed" } | { kind: "read"; wallet: DefaultWallet | null };

/**
 * The signed-in account's default wallet, read once per account and again on a retry. `revision` counts every change,
 * so a read that started before a newer answer (the wallet just made) never replaces it.
 */
const useDefaultWalletStore = create<{ owner: string | null; read: WalletRead; revision: number }>()(() => ({
  owner: null,
  read: { kind: "unread" },
  revision: 0,
}));

const settle = (realmsId: string, read: WalletRead) =>
  useDefaultWalletStore.setState((state) => ({ owner: realmsId, read, revision: state.revision + 1 }));

const readFor = async (realmsId: string) => {
  const started = useDefaultWalletStore.getState().revision;
  const current = () =>
    useDefaultWalletStore.getState().revision === started &&
    useIdentitySessionStore.getState().session?.user.realmsId === realmsId;
  try {
    const wallet = await identityClient.readDefaultWallet();
    if (current()) settle(realmsId, { kind: "read", wallet });
  } catch (error) {
    console.error("default_wallet_read_failed", error);
    if (current()) settle(realmsId, { kind: "failed" });
  }
};

/** The account's wallet just made: every surface shows it at once, and no older read replaces it. */
export const noteDefaultWallet = (realmsId: string, wallet: DefaultWallet) =>
  settle(realmsId, { kind: "read", wallet });

/**
 * The signed-in account's default wallet: `wallet` is undefined while unknown (being read, or its read failed, then
 * `failed` and `retry`), null when the account has none or no one is signed in. Unknown is never taken for none: a
 * surface that needs to know waits or offers the retry. A failed read is tried again when a surface mounts.
 */
export const useDefaultWallet = (): {
  wallet: DefaultWallet | null | undefined;
  failed: boolean;
  retry: () => void;
} => {
  const realmsId = useIdentitySessionStore((state) => state.session?.user.realmsId ?? null);
  const { owner, read } = useDefaultWalletStore();
  const retry = useCallback(() => {
    if (realmsId) void readFor(realmsId);
  }, [realmsId]);
  useEffect(() => {
    const state = useDefaultWalletStore.getState();
    if (realmsId && !(state.owner === realmsId && state.read.kind === "read")) void readFor(realmsId);
  }, [realmsId]);
  if (realmsId === null) return { wallet: null, failed: false, retry };
  if (owner !== realmsId) return { wallet: undefined, failed: false, retry };
  return { wallet: read.kind === "read" ? read.wallet : undefined, failed: read.kind === "failed", retry };
};
