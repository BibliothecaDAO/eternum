import { IdentityRequestError } from "@realms-world/identity";
import { L2_CHAIN } from "@/runtime/l2-rpc";

/** What the player asked for; each names its own failure. */
export type IdentityAction = "discord" | "handoff" | "send-code" | "code" | "link" | "unlink" | "portrait";

export class WrongNetworkError extends Error {}

/**
 * Each failure says what happened, then what to do about it (audit 10-27, F2): a refusal's way past it is an action,
 * never subtext. Where nothing can be done but wait, the wait is the action.
 */
const NAMED_REFUSALS: Record<string, string> = {
  INVALID_OTP: "That code is not right. Check it and try again.",
  OTP_EXPIRED: "That code expired. Ask for another.",
  TOO_MANY_ATTEMPTS: "Too many tries with that code. Ask for a new one.",
  too_many_codes: "Too many codes. Wait a minute.",
  WALLET_NOT_DEPLOYED: `Deploy this wallet on ${L2_CHAIN.label} first.`,
  WALLET_LINKED_ELSEWHERE: "This wallet is on another account. Link another one.",
  email_not_verified: "Verify your Discord email, or sign in with an email code.",
  email_not_found: "Your Discord account has no email. Add one in Discord, or sign in with an email code.",
  account_not_linked: "This email has an account already. Sign in with an email code.",
  access_denied: "Discord sign-in was cancelled. Try again.",
  please_restart_the_process: "Discord took too long. Try again.",
  HANDOFF_NOT_STARTED: "Press Discord here first, then enter the code it shows.",
};

const FALLBACK: Record<IdentityAction, string> = {
  discord: "Discord sign-in did not complete. Try again.",
  handoff: "That code did not sign you in. Try again.",
  "send-code": "The code was not sent. Check the address and try again.",
  code: "Sign-in did not complete. Try again.",
  link: "The wallet was not linked. Try again.",
  unlink: "The wallet was not unlinked. Try again.",
  portrait: "The portrait was not saved. Try again.",
};

/** One sentence per failure the player can act on; the detail goes to the console. */
export const failureSentence = (action: IdentityAction, cause: unknown): string => {
  console.error("identity_action_failed", { action, error: cause instanceof Error ? cause.message : cause });
  const code = cause instanceof IdentityRequestError ? cause.code : undefined;
  if (code && NAMED_REFUSALS[code]) return NAMED_REFUSALS[code];
  if (cause instanceof WrongNetworkError) return `Switch this wallet to ${L2_CHAIN.label}.`;
  return FALLBACK[action];
};

/** The server names why a name was refused (NAME_TAKEN, NAME_INVALID:<rule>); the player reads one sentence. */
export const nameRefusal = (cause: unknown): string => {
  const reason = cause instanceof Error ? cause.message : "";
  if (reason === "NAME_TAKEN") return "That name is taken. Try another.";
  if (reason.startsWith("NAME_INVALID:")) return `Names use ${reason.slice("NAME_INVALID:".length)}.`;
  console.error("identity_name_claim_failed", { error: reason });
  return "The name was not saved. Try again.";
};
