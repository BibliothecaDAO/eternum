// @vitest-environment node

import { describe, expect, it } from "vitest";

import { isRpcUrlCompatibleForChain, normalizeRpcUrl } from "./normalize";

describe("rpc url helpers", () => {
  it("removes trailing slashes", () => {
    expect(normalizeRpcUrl("https://rpc.realms.test/rpc/v0_9_0///")).toBe("https://rpc.realms.test/rpc/v0_9_0");
  });

  it("leaves normalized urls untouched", () => {
    expect(normalizeRpcUrl("https://rpc.realms.test/rpc/v0_9_0")).toBe("https://rpc.realms.test/rpc/v0_9_0");
  });

  it("accepts explicitly configured RPCs for both game chains", () => {
    expect(isRpcUrlCompatibleForChain("madara", "https://rpc.realms.test/rpc/v0_9_0")).toBe(true);
    expect(isRpcUrlCompatibleForChain("appchain", "https://rpc.jcndata.com")).toBe(true);
  });
});
