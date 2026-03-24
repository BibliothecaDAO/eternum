import { describe, expect, it } from "vitest";
import {
  areSameRpcUrlSets,
  buildControllerRpcUrlList,
  deriveControllerChainFromRpcUrl,
  resolveControllerNetworkConfig,
} from "./controller-chain-config";

describe("controller chain config", () => {
  it("derives slot chain ids from katana world rpc urls", () => {
    const chain = deriveControllerChainFromRpcUrl("https://api.cartridge.gg/x/world-b/katana/rpc/v0_9");

    expect(chain).toEqual({
      kind: "slot",
      chainId: "0x57505f574f524c445f42",
    });
  });

  it("derives starknet mainnet chain ids from rpc urls", () => {
    const chain = deriveControllerChainFromRpcUrl("https://api.cartridge.gg/x/starknet/mainnet/rpc/v0_9");

    expect(chain).toEqual({
      kind: "mainnet",
      chainId: "0x534e5f4d41494e",
    });
  });

  it("builds a deduplicated rpc list including the selected world", () => {
    const urls = buildControllerRpcUrlList({
      primaryRpcUrl: "https://api.cartridge.gg/x/world-b/katana",
      existingRpcUrls: [
        "https://api.cartridge.gg/x/world-b/katana/rpc/v0_9",
        "https://api.cartridge.gg/x/starknet/sepolia/rpc/v0_9",
      ],
    });

    expect(urls).toContain("https://api.cartridge.gg/x/world-b/katana/rpc/v0_9");
    expect(urls).toContain("https://api.cartridge.gg/x/starknet/sepolia/rpc/v0_9");
    expect(urls.length).toBe(new Set(urls).size);
  });

  it("resolves network config with fallback chain ids when rpc cannot be derived", () => {
    const config = resolveControllerNetworkConfig({
      configuredChain: "mainnet",
      rpcUrl: "https://rpc.not-cartridge.example",
    });

    expect(config.resolvedChain.kind).toBe("mainnet");
    expect(config.resolvedChain.chainId).toBe("0x534e5f4d41494e");
    expect(config.normalizedRpcUrl).toBe("https://rpc.not-cartridge.example");
  });

  it("compares rpc url sets without order sensitivity", () => {
    expect(areSameRpcUrlSets(["a", "b"], ["b", "a"])).toBe(true);
    expect(areSameRpcUrlSets(["a", "b"], ["a", "c"])).toBe(false);
  });
});
