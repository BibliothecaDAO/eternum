import { IdentityRequestError } from "@realms-world/identity";
import { afterEach, expect, it, vi } from "vitest";

import { failureSentence, nameRefusal, type IdentityAction, WrongNetworkError } from "./identity-failures";

afterEach(() => vi.restoreAllMocks());

const refused = (action: IdentityAction, code: string) => failureSentence(action, new IdentityRequestError(400, code));

// Every failure the player meets while signing in or linking, as they read it: what happened, then what to do (audit
// 10-27, F2: the recovery steps were cut as subtext; they are the way past the failure).
it.each([
  ["code", "INVALID_OTP", "Wrong code. Check it and try again."],
  ["code", "OTP_EXPIRED", "Code expired. Request a new one."],
  ["code", "TOO_MANY_ATTEMPTS", "Too many tries. Request a new code."],
  ["send-code", "too_many_codes", "Too many codes. Wait a minute."],
  ["link", "WALLET_NOT_DEPLOYED", "Deploy this wallet on Starknet mainnet first."],
  ["link", "WALLET_LINKED_ELSEWHERE", "Wallet is linked to another account. Use another."],
  ["social", "email_not_verified", "Verify that account's email first, or sign in with an email code."],
  ["social", "email_not_found", "That account has no email. Add one, or sign in with an email code."],
  ["social", "account_not_linked", "This email already has an account. Sign in with an email code."],
  ["social", "access_denied", "Sign-in cancelled. Try again."],
  ["social", "please_restart_the_process", "Sign-in timed out. Try again."],
  ["handoff", "HANDOFF_NOT_STARTED", "Start signing in here first, then enter the code it shows."],
] as const)("says what to do when %s is refused with %s", (action, code, sentence) => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect(refused(action, code)).toBe(sentence);
});

it.each([
  ["social", "Sign-in failed. Try again."],
  ["handoff", "Code failed. Try again."],
  ["send-code", "Code not sent. Check your email address and try again."],
  ["code", "Sign-in failed. Try again."],
  ["link", "Could not link wallet. Try again."],
  ["unlink", "Could not unlink wallet. Try again."],
  ["portrait", "Could not save portrait. Try again."],
] as const)("offers a retry when %s fails for a reason with no name", (action, sentence) => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect(failureSentence(action, new Error("RPC unavailable"))).toBe(sentence);
  expect(refused(action, "state_mismatch")).toBe(sentence);
});

it("names the network to switch a wallet to, and a refused name's rule or a retry", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect(failureSentence("link", new WrongNetworkError())).toBe("Switch this wallet to Starknet mainnet.");
  expect(nameRefusal(new Error("NAME_TAKEN"))).toBe("That name is taken. Try another.");
  expect(nameRefusal(new Error("NAME_INVALID:3 to 16 letters"))).toBe("Names use 3 to 16 letters.");
  expect(nameRefusal(new Error("timeout"))).toBe("Could not save name. Try again.");
});
