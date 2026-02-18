import { describe, expect, it } from "vitest";
import { deriveChainIdFromRpcUrl, normalizeRpcUrl } from "../../src/world/normalize";

describe("deriveChainIdFromRpcUrl", () => {
  it("derives per-world chain ID from slot katana URL", () => {
    const result = deriveChainIdFromRpcUrl("https://api.cartridge.gg/x/eternum-blitz-slot-3/katana/rpc/v0_9");
    expect(result).toBeDefined();
    // WP_ETERNUM_BLITZ_SLOT_3 encoded as short string
    expect(typeof result).toBe("string");
    expect(result!.startsWith("0x")).toBe(true);
  });

  it("derives different chain IDs for different slot worlds", () => {
    const id1 = deriveChainIdFromRpcUrl("https://api.cartridge.gg/x/world-alpha/katana");
    const id2 = deriveChainIdFromRpcUrl("https://api.cartridge.gg/x/world-beta/katana");
    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
  });

  it("returns SN_MAIN for mainnet starknet URL", () => {
    const result = deriveChainIdFromRpcUrl("https://api.cartridge.gg/x/starknet/mainnet");
    expect(result).toBe("0x534e5f4d41494e");
  });

  it("returns SN_SEPOLIA for sepolia starknet URL", () => {
    const result = deriveChainIdFromRpcUrl("https://api.cartridge.gg/x/starknet/sepolia");
    expect(result).toBe("0x534e5f5345504f4c4941");
  });

  it("returns null for non-cartridge URLs", () => {
    const result = deriveChainIdFromRpcUrl("https://some-rpc.example.com/rpc");
    expect(result).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(deriveChainIdFromRpcUrl("")).toBeNull();
  });

  it("returns null for invalid URL", () => {
    expect(deriveChainIdFromRpcUrl("not-a-url")).toBeNull();
  });

  it("returns null when slug exceeds 31 characters", () => {
    const longSlug = "a".repeat(30); // WP_ + 30 = 33 > 31
    const result = deriveChainIdFromRpcUrl(`https://api.cartridge.gg/x/${longSlug}/katana`);
    expect(result).toBeNull();
  });

  it("handles katana URL without rpc version suffix", () => {
    const result = deriveChainIdFromRpcUrl("https://api.cartridge.gg/x/my-world/katana");
    expect(result).toBeDefined();
  });
});

describe("normalizeRpcUrl", () => {
  it("appends /rpc/v0_9 to katana URLs", () => {
    const result = normalizeRpcUrl("https://api.cartridge.gg/x/my-world/katana");
    expect(result).toBe("https://api.cartridge.gg/x/my-world/katana/rpc/v0_9");
  });

  it("does not double-append version path", () => {
    const result = normalizeRpcUrl("https://api.cartridge.gg/x/my-world/katana/rpc/v0_9");
    expect(result).toBe("https://api.cartridge.gg/x/my-world/katana/rpc/v0_9");
  });

  it("appends version to starknet mainnet URLs", () => {
    const result = normalizeRpcUrl("https://api.cartridge.gg/x/starknet/mainnet");
    expect(result).toBe("https://api.cartridge.gg/x/starknet/mainnet/rpc/v0_9");
  });

  it("returns non-cartridge URLs unchanged", () => {
    const url = "https://some-rpc.example.com/rpc";
    expect(normalizeRpcUrl(url)).toBe(url);
  });
});
