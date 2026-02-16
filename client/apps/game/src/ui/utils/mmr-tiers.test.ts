import { describe, expect, it } from "vitest";

import { getMMRTier, getMMRTierFromRaw, MMR_TOKEN_DECIMALS } from "./mmr-tiers";

describe("mmr tiers", () => {
  it("maps integer MMR to expected tier", () => {
    expect(getMMRTier(3000).name).toBe("Elite");
    expect(getMMRTier(2400).name).toBe("Master");
    expect(getMMRTier(1499).name).toBe("Gold");
    expect(getMMRTier(149).name).toBe("Iron");
  });

  it("maps raw token MMR to expected tier", () => {
    expect(getMMRTierFromRaw(1950n * MMR_TOKEN_DECIMALS).name).toBe("Diamond");
    expect(getMMRTierFromRaw(600n * MMR_TOKEN_DECIMALS).name).toBe("Silver");
  });
});
