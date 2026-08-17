// @vitest-environment node

import { describe, expect, it } from "vitest";

import { buildSigningMessages } from "./signing-policy";

describe("buildSigningMessages", () => {
  it("uses the mainnet typed-data chain id for mainnet games", () => {
    expect(buildSigningMessages("mainnet")[0]?.domain.chainId).toBe("SN_MAIN");
  });

  it("declares no offchain-message typed data on chains without the Message model", () => {
    // The Message model only exists on legacy worlds; announcing an
    // SN_SEPOLIA signing domain on the appchain was wrong.
    expect(buildSigningMessages("appchain")).toEqual([]);
    expect(buildSigningMessages("local")).toEqual([]);
  });

  it("keeps legacy chains on the existing non-mainnet typed-data chain id", () => {
    expect(buildSigningMessages("sepolia")[0]?.domain.chainId).toBe("SN_SEPOLIA");
  });
});
