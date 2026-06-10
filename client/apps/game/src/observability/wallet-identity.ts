import { env } from "../../env";

type WalletIdentityMode = "hashed" | "raw" | "none";

export const resolveWalletIdentityMode = (): WalletIdentityMode => {
  const configured = env.VITE_PUBLIC_SENTRY_TX_WALLET_IDENTITY;
  return configured === "raw" || configured === "none" ? configured : "hashed";
};

export const resolveUserIdentity = async (walletAddress: string | null | undefined): Promise<string | null> => {
  if (!walletAddress) return null;

  const mode = resolveWalletIdentityMode();
  if (mode === "none") return null;
  if (mode === "raw") return walletAddress;

  if (typeof globalThis.crypto?.subtle === "undefined") return null;

  const payload = new TextEncoder().encode(walletAddress.toLowerCase());
  const digest = await globalThis.crypto.subtle.digest("SHA-256", payload);
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `wallet:${hash}`;
};
