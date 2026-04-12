// @vitest-environment node

import { constants } from "starknet";
import { describe, expect, it } from "vitest";

import { resolveStarknetRuntimeConfig } from "./starknet-chain-config";

describe("resolveStarknetRuntimeConfig", () => {
  it("uses the selected mainnet chain instead of the startup slot configuration", () => {
    const config = resolveStarknetRuntimeConfig({
      fallbackChain: "slot",
      selectedChain: "mainnet",
      baseRpcUrl: "https://api.cartridge.gg/x/eternum-blitz-slot-4/katana/rpc/v0_9",
      cartridgeApiBase: "https://api.cartridge.gg",
    });

    expect(config.chainKind).toBe("mainnet");
    expect(config.defaultChainId).toBe(constants.StarknetChainId.SN_MAIN);
    expect(config.rpcUrl).toBe("https://api.cartridge.gg/x/starknet/mainnet/rpc/v0_9");
  });

  it("keeps slot worlds on the selected slot runtime and derives the controller chain id from the active rpc", () => {
    const config = resolveStarknetRuntimeConfig({
      fallbackChain: "mainnet",
      selectedChain: "slot",
      baseRpcUrl: "https://api.cartridge.gg/x/eternum-blitz-slot-4/katana/rpc/v0_9",
      cartridgeApiBase: "https://api.cartridge.gg",
    });

    expect(config.chainKind).toBe("slot");
    expect(config.rpcUrl).toBe("https://api.cartridge.gg/x/eternum-blitz-slot-4/katana/rpc/v0_9");
    expect(config.defaultChainId).toBe("0x57505f455445524e554d5f424c49545a5f534c4f545f34");
  });
});
