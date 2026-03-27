// @vitest-environment node

import { describe, expect, it } from "vitest";

import { computeMarketCapLords } from "./game-amm-market-cap";

describe("computeMarketCapLords", () => {
  it("computes market cap in lords from raw supply and spot price", () => {
    expect(computeMarketCapLords(36_000n, 22_000 / 36_000)).toBe(22_000n);
  });

  it("returns null when price is unavailable", () => {
    expect(computeMarketCapLords(36_000n, Number.NaN)).toBeNull();
    expect(computeMarketCapLords(36_000n, undefined)).toBeNull();
  });

  it("handles zero supply", () => {
    expect(computeMarketCapLords(0n, 0.611111111111)).toBe(0n);
  });
});
