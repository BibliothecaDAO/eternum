import { IdentityRequestError } from "@realms-world/identity";
import { describe, expect, it, vi } from "vitest";

import { failureSentence } from "./identity-failures";

describe("identity failure sentences", () => {
  it("names a Discord refusal a retry cannot fix, and falls back to a retry only for the rest", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const discord = (code: string) => failureSentence("discord", new IdentityRequestError(400, code));
    expect(discord("email_not_verified")).toMatch(/not verified/);
    expect(discord("email_not_found")).toMatch(/no email/);
    expect(discord("account_not_linked")).toMatch(/email code/);
    expect(discord("state_mismatch")).toBe("Discord sign-in did not complete. Try again.");
  });
});
