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
  | "recover"
  | "delete";

export class WrongNetworkError extends Error {}

/**
 * Each failure says what happened, then what to do about it (audit 10-27, F2): a refusal's way past it is an action,
 * never subtext. Where nothing can be done but wait, the wait is the action.
 */
const NAMED_REFUSALS: Record<string, string> = {
  INVALID_OTP: "Wrong code. Check it and try again.",
  OTP_EXPIRED: "Code expired. Request a new one.",
  TOO_MANY_ATTEMPTS: "Too many tries. Request a new code.",
  too_many_codes: "Too many codes. Wait a minute.",
  WALLET_NOT_DEPLOYED: `Deploy this wallet on ${L2_CHAIN.label} first.`,
  WALLET_LINKED_ELSEWHERE: "Wallet is linked to another account. Use another.",
  email_not_verified: "Verify that account's email first, or sign in with an email code.",
  email_not_found: "That account has no email. Add one, or sign in with an email code.",
  account_not_linked: "This email already has an account. Sign in with an email code.",
  access_denied: "Sign-in cancelled. Try again.",
  please_restart_the_process: "Sign-in timed out. Try again.",
  HANDOFF_NOT_STARTED: "Start signing in here first, then enter the code it shows.",
  WALLET_ALREADY_LINKED: "This account already has a payout wallet. Reload to see it.",
  PASSKEY_INVALID: "This passkey cannot create a wallet. Try again.",
  // Only a recovery step is sponsored; sends pay their own fee and never meet it.
  SPONSOR_UNAVAILABLE: "Recovery opens soon. Your LORDS stay safe in your wallet.",
  SPONSOR_CAP_REACHED: "Daily recovery limit reached. Try again tomorrow.",
  PAYMASTER_REFUSED: "Transaction rejected. Check you have enough LORDS for the amount and fee.",
  RECOVERY_UNDER_WAY: "Recovery is already in progress on this wallet.",
  // Never "not sent": the paymaster's answer was lost, and it may have gone through.
  SEND_UNCERTAIN: "No network reply. Your transfer may still succeed. Check back in a minute.",
};

const FALLBACK: Record<IdentityAction, string> = {
  social: "Sign-in failed. Try again.",
  handoff: "Code failed. Try again.",
  "send-code": "Code not sent. Check your email address and try again.",
  code: "Sign-in failed. Try again.",
  link: "Could not link wallet. Try again.",
  unlink: "Could not unlink wallet. Try again.",
  portrait: "Could not save portrait. Try again.",
  wallet: "Could not create wallet. Try again.",
  send: "Transfer failed. Try again.",
  recover: "Could not start recovery. Try again.",
  delete: "Could not delete account. Try again.",
};

/** One sentence per failure the player can act on; the detail goes to the console. */
export const failureSentence = (action: IdentityAction, cause: unknown): string => {
  console.error("identity_action_failed", { action, error: cause instanceof Error ? cause.message : cause });
  const code = cause instanceof IdentityRequestError ? cause.code : undefined;
  if (code && NAMED_REFUSALS[code]) return NAMED_REFUSALS[code];
  if (cause instanceof WrongNetworkError) return `Switch this wallet to ${L2_CHAIN.label}.`;
  if (cause instanceof UncertainSendNotKeptError)
    return "Browser storage is full or private, so nothing was sent. Free space or exit private mode.";
  if (cause instanceof PasskeyUnavailableError)
    return "This browser does not support passkeys. Open the game in your main browser.";
  // Asked to make a passkey this device already holds (a recovery's excludeCredentials).
  if ((cause as { name?: unknown } | null)?.name === "InvalidStateError")
    return "This device already has your passkey. Use it to send or cancel recovery.";
  // The browser's own refusal: the player closed the passkey sheet, or it timed out.
  if ((cause as { name?: unknown } | null)?.name === "NotAllowedError") return "Passkey cancelled. Try again.";
  return FALLBACK[action];
};

/** The server names why a name was refused (NAME_TAKEN, NAME_INVALID:<rule>); the player reads one sentence. */
export const nameRefusal = (cause: unknown): string => {
  const reason = cause instanceof Error ? cause.message : "";
  if (reason === "NAME_TAKEN") return "That name is taken. Try another.";
  if (reason.startsWith("NAME_INVALID:")) return `Names use ${reason.slice("NAME_INVALID:".length)}.`;
  console.error("identity_name_claim_failed", { error: reason });
  return "Could not save name. Try again.";
};
