// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("@contracts", () => ({
  getSeasonAddresses: (network: string) => ({
    "Collectibles: Realms: Cosmetic Items": `0x${network}-cosmetics`,
    "Collectibles: Realms: Loot Chest": `0x${network}-loot`,
    cosmeticsClaim: `0x${network}-claim`,
  }),
}));

vi.mock("../../../../../env", () => ({
  env: {
    VITE_PUBLIC_CHAIN: "slot",
    VITE_PUBLIC_MARKETPLACE_URL: "https://example.com/torii",
  },
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
    const slotChainId = "0x57505f455445524e554d5f424c49545a5f534c4f545f33";
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
