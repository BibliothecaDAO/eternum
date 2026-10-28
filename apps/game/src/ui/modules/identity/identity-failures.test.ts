import { IdentityRequestError } from "@realms-world/identity";
import { afterEach, expect, it, vi } from "vitest";

import { failureSentence, nameRefusal, type IdentityAction, WrongNetworkError } from "./identity-failures";

afterEach(() => vi.restoreAllMocks());

const refused = (action: IdentityAction, code: string) => failureSentence(action, new IdentityRequestError(400, code));

// Every failure the player meets while signing in or linking, as they read it: what happened, then what to do (audit
// 10-27, F2: the recovery steps were cut as subtext; they are the way past the failure).
it.each([
  ["code", "INVALID_OTP", "That code is not right. Check it and try again."],
  ["code", "OTP_EXPIRED", "That code expired. Ask for another."],
  ["code", "TOO_MANY_ATTEMPTS", "Too many tries with that code. Ask for a new one."],
  ["send-code", "too_many_codes", "Too many codes. Wait a minute."],
  ["link", "WALLET_NOT_DEPLOYED", "Deploy this wallet on Starknet mainnet first."],
  ["link", "WALLET_LINKED_ELSEWHERE", "This wallet is on another account. Link another one."],
  ["discord", "email_not_verified", "Verify your Discord email, or sign in with an email code."],
  [
    "discord",
    "email_not_found",
    "Your Discord account has no email. Add one in Discord, or sign in with an email code.",
  ],
  ["discord", "account_not_linked", "This email has an account already. Sign in with an email code."],
  ["discord", "access_denied", "Discord sign-in was cancelled. Try again."],
  ["discord", "please_restart_the_process", "Discord took too long. Try again."],
  ["handoff", "HANDOFF_NOT_STARTED", "Press Discord here first, then enter the code it shows."],
] as const)("says what to do when %s is refused with %s", (action, code, sentence) => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect(refused(action, code)).toBe(sentence);
});

it.each([
  ["discord", "Discord sign-in did not complete. Try again."],
  ["handoff", "That code did not sign you in. Try again."],
  ["send-code", "The code was not sent. Check the address and try again."],
  ["code", "Sign-in did not complete. Try again."],
  ["link", "The wallet was not linked. Try again."],
  ["unlink", "The wallet was not unlinked. Try again."],
  ["portrait", "The portrait was not saved. Try again."],
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
  expect(nameRefusal(new Error("timeout"))).toBe("The name was not saved. Try again.");
});
