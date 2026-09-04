// @vitest-environment node
import { describe, expect, it } from "vitest";

import { resolveCosmeticsLoadoutScopeKeyForChain } from "./loadout-scope";

describe("resolveCosmeticsLoadoutScopeKeyForChain", () => {
  it("keeps Madara cosmetics isolated", () => {
    expect(resolveCosmeticsLoadoutScopeKeyForChain("madara")).toBe("cosmetics:madara");
  });

  it("keeps appchain cosmetics isolated", () => {
    expect(resolveCosmeticsLoadoutScopeKeyForChain("appchain")).toBe("cosmetics:appchain");
  });
});
