import { IdentityRequestError } from "@realms-world/identity";

/** What the player asked for; each names its own failure. */
export type IdentityAction = "discord" | "send-code" | "code" | "link";

export class WrongNetworkError extends Error {}

const NAMED_REFUSALS: Record<string, string> = {
  INVALID_OTP: "That code is not right. Check it and try again.",
  OTP_EXPIRED: "That code has expired. Ask for a new one.",
  TOO_MANY_ATTEMPTS: "Too many tries with that code. Ask for a new one.",
  too_many_codes: "Too many codes for this address. Wait a minute and ask again.",
  WALLET_LINKED_ELSEWHERE: "This wallet is linked to another Realms account.",
  WALLET_ALREADY_LINKED: "This account already has a linked wallet.",
};

const FALLBACK: Record<IdentityAction, string> = {
  discord: "Discord sign-in did not complete. Try again.",
  "send-code": "The code was not sent. Check the address and try again.",
  code: "Sign-in did not complete. Try again in a moment.",
  link: "The wallet was not linked. Try again in a moment.",
};

/** One sentence per failure the player can act on; the detail goes to the console. */
export const failureSentence = (action: IdentityAction, cause: unknown): string => {
  console.error("identity_action_failed", { action, error: cause instanceof Error ? cause.message : cause });
  const code = cause instanceof IdentityRequestError ? cause.code : undefined;
  if (code && NAMED_REFUSALS[code]) return NAMED_REFUSALS[code];
  if (cause instanceof WrongNetworkError) return "Switch this wallet to Starknet mainnet.";
  return FALLBACK[action];
};
