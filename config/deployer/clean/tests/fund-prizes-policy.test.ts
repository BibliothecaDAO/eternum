import { describe, expect, test } from "bun:test";
import { resolvePrizeFundingEnvironment } from "../cli/fund-prizes";

describe("operator prize-funding environment policy", () => {
  test("accepts only explicit mainnet operator environments", () => {
    expect(resolvePrizeFundingEnvironment("mainnet.blitz")).toBe("mainnet.blitz");
    expect(resolvePrizeFundingEnvironment("mainnet.eternum")).toBe("mainnet.eternum");
    expect(() => resolvePrizeFundingEnvironment("sepolia.blitz")).toThrow("operator-only mainnet");
  });

  test("keeps historical Slot environments read-only", () => {
    expect(() => resolvePrizeFundingEnvironment("slot.blitz")).toThrow("read-only");
    expect(() => resolvePrizeFundingEnvironment("slottest.eternum")).toThrow("read-only");
  });
});
