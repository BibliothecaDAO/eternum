import { describe, expect, it } from "vitest";

import { assertIndexedOwnership, parseOwnershipAssertion } from "./realm-ownership-smoke.mjs";

describe("Realm ownership deployment smoke validation", () => {
  it("requires a wallet and expected count together", () => {
    expect(() => parseOwnershipAssertion(undefined, undefined)).toThrow("REALM_OWNERSHIP_SMOKE_ADDRESS is required");
    expect(() => parseOwnershipAssertion("0x123", undefined)).toThrow(
      "REALM_OWNERSHIP_SMOKE_EXPECTED_COUNT is required",
    );
  });

  it("rejects a healthy checkpoint with an empty ownership index", () => {
    expect(() => assertIndexedOwnership(0, 0, 17)).toThrow("contains no ownership records");
  });

  it("rejects the wrong ownership count for the assertion wallet", () => {
    expect(() => assertIndexedOwnership(5_133, 16, 17)).toThrow("Expected 17 Realms");
  });
});
