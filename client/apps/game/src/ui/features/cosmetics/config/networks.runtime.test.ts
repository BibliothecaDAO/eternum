// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const marketplaceRegistry = JSON.stringify({
  schemaVersion: "realms-runtime-registry/v1",
  revision: 1,
  generatedAt: "2026-07-21T00:00:00.000Z",
  aliases: {
    "game.mainnet.eternum.eternum-marketplace-mainnet19.torii.base": {
      scope: "game",
      environmentId: "mainnet.eternum",
      runtimeKind: "torii",
      endpointKind: "base",
      activeProvider: "aws",
      runtimeName: "eternum-marketplace-mainnet19",
      runtimeInstanceId: "c44e7b79-a78c-4c6b-8435-c94cf167d990",
      imageDigest: `sha256:${"a".repeat(64)}`,
      routingShard: 0,
      providers: {
        aws: "https://s0.mainnet-eternum.runtime.realms.world/x/mainnet-eternum/eternum-marketplace-mainnet19/torii",
      },
    },
    "game.sepolia.eternum.eternum-marketplace-sepolia-1.torii.base": {
      scope: "game",
      environmentId: "sepolia.eternum",
      runtimeKind: "torii",
      endpointKind: "base",
      activeProvider: "aws",
      runtimeName: "eternum-marketplace-sepolia-1",
      runtimeInstanceId: "acaa3c98-dd69-403b-8f3e-8680e13082b7",
      imageDigest: `sha256:${"b".repeat(64)}`,
      routingShard: 0,
      providers: {
        aws: "https://s0.sepolia-eternum.runtime.realms.world/x/sepolia-eternum/eternum-marketplace-sepolia-1/torii",
      },
    },
  },
});

const envState = {
  VITE_PUBLIC_CHAIN: "slot",
  VITE_PUBLIC_MARKETPLACE_URL: "https://example.com/torii",
  VITE_PUBLIC_RUNTIME_REGISTRY_JSON: marketplaceRegistry,
};

vi.mock("@contracts", () => ({
  getSeasonAddresses: (network: string) => ({
    "Collectibles: Realms: Cosmetic Items": `0x${network}-cosmetics`,
    "Collectibles: Realms: Loot Chest": `0x${network}-loot`,
    cosmeticsClaim: `0x${network}-claim`,
  }),
}));

vi.mock("../../../../../env", () => ({
  env: envState,
}));

class MutableRpcController {
  constructor(private currentRpcUrl: string) {}

  rpcUrl() {
    return this.currentRpcUrl;
  }

  setRpcUrl(nextRpcUrl: string) {
    this.currentRpcUrl = nextRpcUrl;
  }
}

describe("resolveConnectedTxNetworkFromRuntime", () => {
  it("tracks controller RPC changes even when chainId remains slot", async () => {
    const { resolveConnectedTxNetworkFromRuntime } = await import("./networks");
    const slotChainId = "0x57505f455445524e554d5f424c49545a5f534c4f545f34";
    const controller = new MutableRpcController("https://api.cartridge.gg/x/starknet/mainnet/rpc/v0_9");

    expect(resolveConnectedTxNetworkFromRuntime({ chainId: slotChainId, controller })).toBe("mainnet");

    controller.setRpcUrl("https://api.cartridge.gg/x/starknet/sepolia/rpc/v0_9");

    expect(resolveConnectedTxNetworkFromRuntime({ chainId: slotChainId, controller })).toBe("sepolia");
  });

  it("falls back to chainId mapping when controller is unavailable", async () => {
    const { resolveConnectedTxNetworkFromRuntime } = await import("./networks");
    expect(resolveConnectedTxNetworkFromRuntime({ chainId: "SN_MAIN" })).toBe("mainnet");
    expect(resolveConnectedTxNetworkFromRuntime({ chainId: "SN_SEPOLIA" })).toBe("sepolia");
  });
});

describe("marketplace URL resolution", () => {
  it("does not reuse a sepolia generic URL for mainnet network config", async () => {
    vi.resetModules();
    envState.VITE_PUBLIC_CHAIN = "mainnet";
    envState.VITE_PUBLIC_MARKETPLACE_URL = "https://api.cartridge.gg/x/eternum-marketplace-sepolia-1/torii";

    const { COSMETICS_NETWORK_CONFIG } = await import("./networks");

    expect(COSMETICS_NETWORK_CONFIG.mainnet.marketplaceUrl).toContain("mainnet");
    expect(COSMETICS_NETWORK_CONFIG.sepolia.marketplaceUrl).toContain("sepolia");
  });
});
