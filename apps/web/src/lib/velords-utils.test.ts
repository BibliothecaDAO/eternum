/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { describe, expect, it } from "vitest";
import { parseEther } from "viem";

import {
  calculateSharePercent,
  computeTvlUsd,
  formatTokenAmountDisplay,
  parseOptionalStakeAmount,
} from "./velords-utils";

describe("parseOptionalStakeAmount", () => {
  it("returns undefined for empty or zero stake values", () => {
    expect(parseOptionalStakeAmount("")).toBeUndefined();
    expect(parseOptionalStakeAmount("   ")).toBeUndefined();
    expect(parseOptionalStakeAmount("0")).toBeUndefined();
    expect(parseOptionalStakeAmount("0.0")).toBeUndefined();
  });

  it("parses positive stake values", () => {
    expect(parseOptionalStakeAmount("1.25")).toBe(parseEther("1.25"));
  });
});

describe("computeTvlUsd", () => {
  it("returns 0 when locked LORDS is zero", () => {
    expect(computeTvlUsd(0n, 0.5)).toBe(0);
  });

  it("returns expected USD TVL for valid inputs", () => {
    expect(computeTvlUsd(parseEther("100"), 0.25)).toBe(25);
  });

  it("returns undefined when price is unavailable", () => {
    expect(computeTvlUsd(parseEther("100"), undefined)).toBeUndefined();
  });
});

describe("calculateSharePercent", () => {
  it("returns 0.00 when total supply is zero", () => {
    expect(calculateSharePercent(1n, 0n)).toBe("0.00");
  });

  it("calculates a share percentage using bigint-safe math", () => {
    expect(calculateSharePercent(parseEther("25"), parseEther("100"))).toBe(
      "25.00",
    );
    expect(calculateSharePercent(1n, 3n)).toBe("33.33");
  });
});

describe("formatTokenAmountDisplay", () => {
  it("formats large values with separators without numeric casting", () => {
    expect(
      formatTokenAmountDisplay(
        BigInt("123456789012345678901234567890000000000"),
        { maximumFractionDigits: 0 },
      ),
    ).toBe("123,456,789,012,345,678,901");
  });
});
