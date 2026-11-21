import { IdentityRequestError, type FragmentPayment } from "@realms-world/identity";

import { identityClient } from "@/hooks/context/identity-session";

const KEY = "realms.fragment-payment";

export interface SentPayment {
  quoteId: string;
  hash: string;
  fragments: number;
}

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

export const followPayment = async ({ quoteId, hash }: SentPayment): Promise<FragmentPayment> => {
  try {
    return await identityClient.fragmentPayment(hash);
  } catch (error) {
    if (error instanceof IdentityRequestError && error.code === "unknown_payment")
      return identityClient.payFragments(quoteId, hash);
    throw error;
  }
};
