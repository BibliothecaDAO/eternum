import { describe, expect, it } from "vitest";

import { resolveRealmBootstrapErrorMessage } from "./realm-bootstrap-error";

describe("realm bootstrap error copy", () => {
  it("turns nonce and transport failures into actionable player guidance", () => {
    expect(resolveRealmBootstrapErrorMessage(new Error("Invalid transaction nonce: got 0x6"))).toContain(
      "previous action is still syncing",
    );
    expect(resolveRealmBootstrapErrorMessage(new Error("Failed to fetch"))).toContain("Check your connection");
  });

  it("does not expose an unknown RPC payload", () => {
    const message = resolveRealmBootstrapErrorMessage({ transaction: { calldata: ["0x1", "0x2"] } });
    expect(message).toBe("Realm setup failed. Wait a moment and try again; reopen the game if it keeps failing.");
    expect(message).not.toContain("calldata");
  });
});
