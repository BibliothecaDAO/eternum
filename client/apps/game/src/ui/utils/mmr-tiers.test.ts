import { describe, expect, it } from "vitest";

import { getMMRTier, getMMRTierFromRaw, MMR_TOKEN_DECIMALS } from "./mmr-tiers";

describe("mmr tiers", () => {
  it("maps integer MMR to expected tier", () => {
    expect(getMMRTier(3000).name).toBe("Storm Lord");
    expect(getMMRTier(2400).name).toBe("Storm Lord");
    expect(getMMRTier(2399).name).toBe("Warlord");
    expect(getMMRTier(1600).name).toBe("Conqueror");
    expect(getMMRTier(1200).name).toBe("Marauder");
    expect(getMMRTier(1199).name).toBe("Raider");
    expect(getMMRTier(599).name).toBe("Scrapper");
  });

  it("uses project tailwind tokens for tier colors", () => {
    expect(getMMRTier(3000).color).toBe("text-relic2");
    expect(getMMRTier(2200).color).toBe("text-light-red");
    expect(getMMRTier(1800).color).toBe("text-blueish");
    expect(getMMRTier(1400).color).toBe("text-brilliance");
    expect(getMMRTier(800).color).toBe("text-gold");
    expect(getMMRTier(0).color).toBe("text-gray-gold");
  });

  it("maps raw token MMR to expected tier", () => {
    expect(getMMRTierFromRaw(2400n * MMR_TOKEN_DECIMALS).name).toBe("Storm Lord");
    expect(getMMRTierFromRaw(600n * MMR_TOKEN_DECIMALS).name).toBe("Raider");
  });
});
