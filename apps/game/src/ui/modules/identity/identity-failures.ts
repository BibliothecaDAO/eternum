import { IdentityRequestError } from "@realms-world/identity";
import { L2_CHAIN } from "@/runtime/l2-rpc";

/** What the player asked for; each names its own failure. */
export type IdentityAction = "discord" | "handoff" | "send-code" | "code" | "link" | "unlink" | "portrait";

export class WrongNetworkError extends Error {}

const NAMED_REFUSALS: Record<string, string> = {
  INVALID_OTP: "That code is not right.",
  OTP_EXPIRED: "That code expired. Ask for another.",
  TOO_MANY_ATTEMPTS: "Too many tries with that code.",
  too_many_codes: "Too many codes. Wait a minute.",
  WALLET_NOT_DEPLOYED: `Deploy this wallet on ${L2_CHAIN.label} first.`,
  WALLET_LINKED_ELSEWHERE: "This wallet is on another account.",
  email_not_verified: "Verify your Discord email first.",
  email_not_found: "Your Discord account has no email.",
  account_not_linked: "This email has an account already.",
  access_denied: "Discord sign-in was cancelled.",
  please_restart_the_process: "Discord took too long. Try again.",
  HANDOFF_NOT_STARTED: "Press Discord here first.",
};

const FALLBACK: Record<IdentityAction, string> = {
  discord: "Discord sign-in did not complete. Try again.",
  handoff: "That code did not sign you in.",
  "send-code": "The code was not sent.",
  code: "Sign-in did not complete.",
  link: "The wallet was not linked.",
  unlink: "The wallet was not unlinked.",
  portrait: "The portrait was not saved.",
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
  return "The name was not saved.";
};
