// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildSigningMessages } from "./signing-policy";

describe("buildSigningMessages", () => {
  it("uses SN_MAIN for mainnet sessions", () => {
    const [message] = buildSigningMessages("mainnet");

    expect(message.domain.chainId).toBe("SN_MAIN");
  });

  it("uses SN_SEPOLIA for non-mainnet sessions", () => {
    const [message] = buildSigningMessages("slot");

    expect(message.domain.chainId).toBe("SN_SEPOLIA");
  });
});
