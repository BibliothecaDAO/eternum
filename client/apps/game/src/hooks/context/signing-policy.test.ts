// @vitest-environment node

import { describe, expect, it } from "vitest";

import { buildSigningMessages } from "./signing-policy";

describe("buildSigningMessages", () => {
  it("uses the mainnet typed-data chain id for mainnet games", () => {
    expect(buildSigningMessages("mainnet")[0]?.domain.chainId).toBe("SN_MAIN");
  });

  it("keeps non-mainnet games on the existing non-mainnet typed-data chain id", () => {
    expect(buildSigningMessages("appchain")[0]?.domain.chainId).toBe("SN_SEPOLIA");
    expect(buildSigningMessages("local")[0]?.domain.chainId).toBe("SN_SEPOLIA");
  });
});
