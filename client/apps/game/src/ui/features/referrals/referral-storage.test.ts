import { describe, expect, it } from "vitest";

import {
  clearStoredReferralAddress,
  getStoredReferralAddress,
  parseReferralAddressFromUrl,
  saveReferralAddress,
} from "./referral-storage";

describe("referral storage", () => {
  it("parses valid referral addresses from URL", () => {
    expect(parseReferralAddressFromUrl("https://example.com/?ref=0xabc")).toBe("0xabc");
    expect(parseReferralAddressFromUrl("https://example.com/play?ref=0xABC")).toBe("0xabc");
  });

  it("ignores invalid referral query params", () => {
    expect(parseReferralAddressFromUrl("https://example.com/?ref=abc")).toBeNull();
    expect(parseReferralAddressFromUrl("https://example.com/?ref=0xzz")).toBeNull();
    expect(parseReferralAddressFromUrl("https://example.com/")).toBeNull();
  });

  it("persists and clears stored referrals", () => {
    clearStoredReferralAddress();
    expect(getStoredReferralAddress()).toBeNull();

    saveReferralAddress("0xabc");
    expect(getStoredReferralAddress()).toBe("0xabc");

    clearStoredReferralAddress();
    expect(getStoredReferralAddress()).toBeNull();
  });
});
