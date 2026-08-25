// @vitest-environment node

import { describe, expect, it } from "vitest";

import { isRpcUrlCompatibleForChain, normalizeRpcUrl } from "./normalize";

describe("rpc url helpers", () => {
  it("appends the rpc version path to bare cartridge starknet endpoints", () => {
    expect(normalizeRpcUrl("https://api.cartridge.gg/x/starknet/mainnet")).toBe(
      "https://api.cartridge.gg/x/starknet/mainnet/rpc/v0_9",
    );
  });

  it("leaves non-cartridge urls untouched", () => {
    expect(normalizeRpcUrl("http://localhost:5050")).toBe("http://localhost:5050");
  });

  it("only accepts a cartridge rpc that matches the requested public chain", () => {
    expect(isRpcUrlCompatibleForChain("mainnet", "https://api.cartridge.gg/x/starknet/mainnet/rpc/v0_9")).toBe(true);
    expect(isRpcUrlCompatibleForChain("mainnet", "https://api.cartridge.gg/x/starknet/sepolia/rpc/v0_9")).toBe(false);
    expect(isRpcUrlCompatibleForChain("sepolia", "https://api.cartridge.gg/x/starknet/sepolia/rpc/v0_9")).toBe(true);
  });

  it("accepts any self-hosted rpc for appchain and local", () => {
    expect(isRpcUrlCompatibleForChain("appchain", "http://my-appchain.example")).toBe(true);
    expect(isRpcUrlCompatibleForChain("local", "http://localhost:5050")).toBe(true);
  });
});
