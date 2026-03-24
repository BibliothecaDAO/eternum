// @vitest-environment node

import { describe, expect, it } from "vitest";
import { resolveAmmAssetPresentation } from "./amm-asset-presentation";
import { formatAmmCompactAmount, formatAmmPercent, formatAmmSpotPrice } from "./amm-format";

const LORDS_ADDRESS = "0x124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49";

describe("amm-asset-presentation", () => {
  it("resolves known resource pools and LORDS into icon-aware presentation models", () => {
    expect(
      resolveAmmAssetPresentation("0x40d8907cec0f7ae9c364dfb12485a1314d84c129bf1898d2f3d4b7fcc7d44f4", LORDS_ADDRESS),
    ).toEqual({
      tokenAddress: "0x40d8907cec0f7ae9c364dfb12485a1314d84c129bf1898d2f3d4b7fcc7d44f4",
      displayName: "Wood",
      shortLabel: "WOOD",
      iconResource: "Wood",
      isLords: false,
    });

    expect(
      resolveAmmAssetPresentation("0x555d713e59d4ff96b7960447e9bc9e79bfdeab5b0eea74e3df81bce61cfbc77", LORDS_ADDRESS),
    ).toEqual({
      tokenAddress: "0x555d713e59d4ff96b7960447e9bc9e79bfdeab5b0eea74e3df81bce61cfbc77",
      displayName: "Cold Iron",
      shortLabel: "COLD IRON",
      iconResource: "Cold Iron",
      isLords: false,
    });

    expect(
      resolveAmmAssetPresentation("0x695b08ecdfdd828c2e6267da62f59e6d7543e690ef56a484df25c8566b332a5", LORDS_ADDRESS),
    ).toEqual({
      tokenAddress: "0x695b08ecdfdd828c2e6267da62f59e6d7543e690ef56a484df25c8566b332a5",
      displayName: "Ancient Fragment",
      shortLabel: "ANCIENT",
      iconResource: "Ancient Fragment",
      isLords: false,
    });

    expect(resolveAmmAssetPresentation(LORDS_ADDRESS, LORDS_ADDRESS)).toEqual({
      tokenAddress: LORDS_ADDRESS,
      displayName: "LORDS",
      shortLabel: "LORDS",
      iconResource: "Lords",
      isLords: true,
    });
  });

  it("falls back safely for unknown tokens", () => {
    expect(resolveAmmAssetPresentation("0xabcdef1234567890", LORDS_ADDRESS)).toEqual({
      tokenAddress: "0xabcdef1234567890",
      displayName: "0xabcdef...",
      shortLabel: "0xABCDEF",
      iconResource: null,
      isLords: false,
    });
  });

  it("formats compact values for AMM dashboard cards", () => {
    expect(formatAmmSpotPrice(1.668345)).toBe("1.6683");
    expect(formatAmmSpotPrice(0.0000000123)).toBe("<0.0001");
    expect(formatAmmPercent(0.3)).toBe("0.30%");
    expect(formatAmmPercent(12)).toBe("12.00%");
    expect(formatAmmCompactAmount(125430n)).toBe("125.4K");
    expect(formatAmmCompactAmount(950n)).toBe("950");
  });
});
