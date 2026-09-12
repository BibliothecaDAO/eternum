// @vitest-environment node

import { describe, expect, it } from "vitest";

import { normalizeRpcUrl } from "./normalize";

describe("rpc url helpers", () => {
  it("removes trailing slashes", () => {
    expect(normalizeRpcUrl("https://rpc.realms.test/rpc/v0_9_0///")).toBe("https://rpc.realms.test/rpc/v0_9_0");
  });

  it("leaves normalized urls untouched", () => {
    expect(normalizeRpcUrl("https://rpc.realms.test/rpc/v0_9_0")).toBe("https://rpc.realms.test/rpc/v0_9_0");
  });
});
