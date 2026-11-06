import { IdentityRequestError } from "@realms-world/identity";
import { L2_CHAIN } from "@/runtime/l2-rpc";
import { PasskeyUnavailableError } from "./passkey";
import { UncertainSendNotKeptError } from "./uncertain-sends";

/** What the player asked for; each names its own failure. */
export type IdentityAction =
  | "social"
  | "handoff"
  | "send-code"
  | "code"
  | "link"
  | "unlink"
  | "portrait"
  | "wallet"
  | "send"
  | "recover";

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
  email_not_verified: "That account's email is not verified. Verify it there, or sign in with an email code.",
  email_not_found: "That account has no email. Add one there, or sign in with an email code.",
  account_not_linked: "This email has an account already. Sign in with an email code.",
  access_denied: "Sign-in was cancelled. Try again.",
  please_restart_the_process: "Sign-in took too long. Try again.",
  HANDOFF_NOT_STARTED: "Start signing in here first, then enter the code it shows.",
  WALLET_ALREADY_LINKED: "This account has a payout wallet already. Reload to see it.",
  PASSKEY_INVALID: "That passkey cannot hold a wallet. Try again on this device.",
  // Only a recovery step is sponsored; sends pay their own fee and never meet it.
  SPONSOR_UNAVAILABLE: "Recovery opens soon. Your LORDS stay safe in your wallet.",
  SPONSOR_CAP_REACHED: "This wallet has used today's recovery steps. Try again tomorrow.",
  PAYMASTER_REFUSED: "The network did not take it. Check your wallet holds enough LORDS for it and its fee.",
  RECOVERY_UNDER_WAY: "A recovery is already under way on this wallet.",
  // Never "not sent": the paymaster's answer was lost, and it may have gone through.
  SEND_UNCERTAIN: "The network did not answer, so it may have gone through. Open this again in a minute to see.",
};

const FALLBACK: Record<IdentityAction, string> = {
  social: "Sign-in did not complete. Try again.",
  handoff: "That code did not sign you in. Try again.",
  "send-code": "The code was not sent. Check the address and try again.",
  code: "Sign-in did not complete. Try again.",
  link: "The wallet was not linked. Try again.",
  unlink: "The wallet was not unlinked. Try again.",
  portrait: "The portrait was not saved. Try again.",
  wallet: "Your wallet was not made. Try again.",
  send: "Nothing was sent. Try again.",
  recover: "The recovery did not start. Try again.",
};

/** One sentence per failure the player can act on; the detail goes to the console. */
export const failureSentence = (action: IdentityAction, cause: unknown): string => {
  console.error("identity_action_failed", { action, error: cause instanceof Error ? cause.message : cause });
  const code = cause instanceof IdentityRequestError ? cause.code : undefined;
  if (code && NAMED_REFUSALS[code]) return NAMED_REFUSALS[code];
  if (cause instanceof WrongNetworkError) return `Switch this wallet to ${L2_CHAIN.label}.`;
  if (cause instanceof UncertainSendNotKeptError)
    return "This browser could not keep a record of the send, so nothing was sent. Free some space, or leave private browsing.";
  if (cause instanceof PasskeyUnavailableError)
    return "This browser cannot use passkeys here. Open the game in your phone's or computer's main browser.";
  // Asked to make a passkey this device already holds (a recovery's excludeCredentials).
  if ((cause as { name?: unknown } | null)?.name === "InvalidStateError")
    return "This device still has your passkey: nothing to recover. Use it to send or to cancel a recovery.";
  // The browser's own refusal: the player closed the passkey sheet, or it timed out.
  if ((cause as { name?: unknown } | null)?.name === "NotAllowedError") return "The passkey was not used. Try again.";
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
