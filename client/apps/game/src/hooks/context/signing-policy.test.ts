// @vitest-environment node

import { describe, expect, it } from "vitest";

import { buildSigningMessages } from "./signing-policy";

describe("buildSigningMessages", () => {
  it("uses the mainnet typed-data chain id for mainnet games", () => {
    expect(buildSigningMessages("mainnet")[0]?.domain.chainId).toBe("SN_MAIN");
  });

  it("keeps slot games on the existing non-mainnet typed-data chain id", () => {
    expect(buildSigningMessages("slot")[0]?.domain.chainId).toBe("SN_SEPOLIA");
  });
});
