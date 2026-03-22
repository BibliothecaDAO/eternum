// @vitest-environment node
import { describe, expect, it } from "vitest";

import { resolveCosmeticsLoadoutScopeKeyForChain } from "./loadout-scope";

describe("resolveCosmeticsLoadoutScopeKeyForChain", () => {
  it("maps mainnet worlds to the mainnet cosmetics scope", () => {
    expect(resolveCosmeticsLoadoutScopeKeyForChain("mainnet")).toBe("cosmetics:mainnet");
  });

  it("maps slot-like worlds to the sepolia cosmetics scope", () => {
    expect(resolveCosmeticsLoadoutScopeKeyForChain("slot")).toBe("cosmetics:sepolia");
    expect(resolveCosmeticsLoadoutScopeKeyForChain("sepolia")).toBe("cosmetics:sepolia");
    expect(resolveCosmeticsLoadoutScopeKeyForChain("local")).toBe("cosmetics:sepolia");
  });
});
