import { describe, expect, it } from "vitest";

import { isConnectedGameplayAccount } from "./use-gameplay-account";

describe("isConnectedGameplayAccount", () => {
  it("treats only a non-zero gameplay account as connected", () => {
    expect(isConnectedGameplayAccount(undefined)).toBe(false);
    expect(isConnectedGameplayAccount("0x0")).toBe(false);
    expect(isConnectedGameplayAccount("0x123")).toBe(true);
  });
});
