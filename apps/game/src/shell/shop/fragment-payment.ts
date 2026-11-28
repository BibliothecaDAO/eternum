import { IdentityRequestError, type FragmentPayment, type ShopPaymentMethods } from "@realms-world/identity";

import { identityClient } from "@/hooks/context/identity-session";

const KEY = "realms.fragment-payment";

export type PaymentRailKey = "stripe" | "starknet" | "evm" | "solana";

export interface ShopGameRef {
  readonly chainId: string;
  readonly gameId: number;
}

export interface SentPayment {
  quoteId: string;
  hash: string;
  fragments: number;
  rail?: PaymentRailKey;
}

export const availableRails = (methods: ShopPaymentMethods | undefined): PaymentRailKey[] => {
  if (!methods) return ["starknet"];
  const rails: PaymentRailKey[] = [];
  if (methods.stripe?.publishableKey) rails.push("stripe");
  if (methods.starknet) rails.push("starknet");
  if (methods.evm?.chainId === 1) rails.push("evm");
  if (methods.solana?.cluster === "mainnet-beta") rails.push("solana");
  return rails;
};

const keyOf = (account: string) => `${KEY}:${account}`;

export const sentPaymentOf = (account: string): SentPayment | null => {
  try {
    return JSON.parse(localStorage.getItem(keyOf(account)) ?? "null") as SentPayment | null;
  } catch {
    return null;
  }
};

export const rememberPayment = (account: string, payment: SentPayment) => {
  try {
    localStorage.setItem(keyOf(account), JSON.stringify(payment));
  } catch (error) {
    console.error("fragment_payment_not_kept", error);
  }
};

export const forgetPayment = (account: string) => {
  try {
    localStorage.removeItem(keyOf(account));
  } catch (error) {
    console.error("fragment_payment_not_forgotten", error);
  }
};

export const followPayment = async ({ quoteId, hash, rail = "starknet" }: SentPayment): Promise<FragmentPayment> => {
  if (rail === "stripe") return identityClient.stripePayment(hash);
  if (rail === "evm" || rail === "solana") {
    try {
      return await identityClient.externalPayment(hash);
    } catch (error) {
      if (error instanceof IdentityRequestError && error.code === "unknown_payment")
        return identityClient.payExternalPayment(quoteId, hash);
      throw error;
    }
  }
  try {
    return await identityClient.fragmentPayment(hash);
  } catch (error) {
    if (error instanceof IdentityRequestError && error.code === "unknown_payment")
      return identityClient.payFragments(quoteId, hash);
    throw error;
  }
};
