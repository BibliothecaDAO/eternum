import { describe, expect, it } from "vitest";

import { getMMRTier, getMMRTierFromRaw, MMR_TOKEN_DECIMALS } from "./mmr-tiers";

describe("mmr tiers", () => {
  it("maps integer MMR to expected tier", () => {
    expect(getMMRTier(3000).name).toBe("Elite");
    expect(getMMRTier(2400).name).toBe("Master");
    expect(getMMRTier(1499).name).toBe("Gold");
    expect(getMMRTier(149).name).toBe("Iron");
  });

  it("uses project tailwind tokens for tier colors", () => {
    expect(getMMRTier(3000).color).toBe("text-relic2");
    expect(getMMRTier(2400).color).toBe("text-light-red");
    expect(getMMRTier(1950).color).toBe("text-blueish");
    expect(getMMRTier(1500).color).toBe("text-brilliance");
    expect(getMMRTier(1050).color).toBe("text-gold");
    expect(getMMRTier(600).color).toBe("text-light-pink");
    expect(getMMRTier(150).color).toBe("text-orange");
    expect(getMMRTier(0).color).toBe("text-gray-gold");
  });

  it("maps raw token MMR to expected tier", () => {
    expect(getMMRTierFromRaw(1950n * MMR_TOKEN_DECIMALS).name).toBe("Diamond");
    expect(getMMRTierFromRaw(600n * MMR_TOKEN_DECIMALS).name).toBe("Silver");
  });
});
