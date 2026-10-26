import { IdentityRequestError } from "@realms-world/identity";
import { describe, expect, it, vi } from "vitest";

import { failureSentence } from "./identity-failures";

describe("identity failure sentences", () => {
  it("names a Discord refusal a retry cannot fix, and falls back to a retry only for the rest", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const discord = (code: string) => failureSentence("discord", new IdentityRequestError(400, code));
    expect(discord("email_not_verified")).toMatch(/Verify your Discord email/);
    expect(discord("email_not_found")).toMatch(/no email/);
    expect(discord("account_not_linked")).toMatch(/has an account/);
    expect(discord("state_mismatch")).toBe("Discord sign-in did not complete. Try again.");
  });
});

it("explains how to link an undeployed wallet while transient failures still offer retry", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect(failureSentence("link", new IdentityRequestError(400, "WALLET_NOT_DEPLOYED"))).toBe(
    "Deploy this wallet on Starknet mainnet first.",
  );
  expect(failureSentence("link", new Error("RPC unavailable"))).toBe("The wallet was not linked.");
});
