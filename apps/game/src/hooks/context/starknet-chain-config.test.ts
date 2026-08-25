// @vitest-environment node

import { constants, shortString } from "starknet";
import { describe, expect, it } from "vitest";

import { APPCHAIN_CHAIN_ID, resolveStarknetRuntimeConfig } from "./starknet-chain-config";

describe("resolveStarknetRuntimeConfig", () => {
  it("falls back to the sepolia runtime rpc when the selected chain changes away from an incompatible startup rpc", () => {
    const config = resolveStarknetRuntimeConfig({
      fallbackChain: "mainnet",
      selectedChain: "sepolia",
      baseRpcUrl: "https://api.cartridge.gg/x/starknet/mainnet/rpc/v0_9",
      cartridgeApiBase: "https://api.cartridge.gg",
    });

    expect(config.chainKind).toBe("sepolia");
    expect(config.rpcUrl).toBe("https://api.cartridge.gg/x/starknet/sepolia/rpc/v0_9");
    expect(config.defaultChainId).toBe(constants.StarknetChainId.SN_SEPOLIA);
  });

  it("preserves a configured compatible mainnet rpc instead of forcing the cartridge default", () => {
    const config = resolveStarknetRuntimeConfig({
      fallbackChain: "mainnet",
      selectedChain: "mainnet",
      baseRpcUrl: "https://mainnet.example-rpc.invalid/rpc",
      cartridgeApiBase: "https://api.cartridge.gg",
    });

    expect(config.chainKind).toBe("mainnet");
    expect(config.defaultChainId).toBe(constants.StarknetChainId.SN_MAIN);
    expect(config.rpcUrl).toBe("https://mainnet.example-rpc.invalid/rpc");
  });

  it("uses the selected mainnet chain instead of an incompatible startup cartridge rpc", () => {
    const config = resolveStarknetRuntimeConfig({
      fallbackChain: "appchain",
      selectedChain: "mainnet",
      baseRpcUrl: "https://api.cartridge.gg/x/starknet/sepolia/rpc/v0_9",
      cartridgeApiBase: "https://api.cartridge.gg",
    });

    expect(config.chainKind).toBe("mainnet");
    expect(config.defaultChainId).toBe(constants.StarknetChainId.SN_MAIN);
    expect(config.rpcUrl).toBe("https://api.cartridge.gg/x/starknet/mainnet/rpc/v0_9");
  });

  it("keeps the self-hosted appchain on its own rpc and bespoke controller chain id", () => {
    const config = resolveStarknetRuntimeConfig({
      fallbackChain: "mainnet",
      selectedChain: "appchain",
      baseRpcUrl: "http://realms-appchain.invalid",
      cartridgeApiBase: "https://api.cartridge.gg",
    });

    expect(config.chainKind).toBe("appchain");
    expect(config.rpcUrl).toBe("http://realms-appchain.invalid");
    expect(config.defaultChainId).toBe(APPCHAIN_CHAIN_ID);
    expect(config.defaultChainId).toBe(shortString.encodeShortString("WP_REALMS_DEV"));
    // No cartridge-hosted fallbacks apply to a self-hosted katana.
    expect(config.controllerSupportedRpcUrls).toEqual(["http://realms-appchain.invalid"]);
  });

  it("pins the local chain to the katana default rpc", () => {
    const config = resolveStarknetRuntimeConfig({
      fallbackChain: "mainnet",
      selectedChain: "local",
      baseRpcUrl: "https://api.cartridge.gg/x/starknet/mainnet/rpc/v0_9",
      cartridgeApiBase: "https://api.cartridge.gg",
    });

    expect(config.chainKind).toBe("local");
    expect(config.rpcUrl).toBe("http://localhost:5050");
  });
});
