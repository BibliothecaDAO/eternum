import { afterEach, describe, expect, it } from "bun:test";
import { expectedChainId } from "../../../packages/chain/chain-guard.js";
import { assertSelectedProviderChain } from "./starknet.js";

const originalEnvironment = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnvironment };
});

describe("asset-script chain guard", () => {
  it("refuses a mainnet RPC when Sepolia output is selected", async () => {
    process.env.STARKNET_NETWORK = "sepolia";
    const provider = { getChainId: async () => expectedChainId("mainnet") };

    await expect(assertSelectedProviderChain(provider)).rejects.toThrow("STARKNET_RPC is not Starknet Sepolia");
  });

  it("requires an explicit chain id for custom networks", async () => {
    process.env.STARKNET_NETWORK = "local";
    delete process.env.STARKNET_EXPECTED_CHAIN_ID;
    const provider = { getChainId: async () => "0x123" };

    await expect(assertSelectedProviderChain(provider)).rejects.toThrow("STARKNET_EXPECTED_CHAIN_ID");
  });

  it("refuses a mainnet RPC when the appchain is selected", async () => {
    process.env.STARKNET_NETWORK = "appchain";
    const provider = { getChainId: async () => expectedChainId("mainnet") };

    await expect(assertSelectedProviderChain(provider)).rejects.toThrow("STARKNET_RPC is not appchain");
  });
});
