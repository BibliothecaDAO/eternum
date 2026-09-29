import { afterEach, describe, expect, it } from "bun:test";
import { expectedChainId } from "../../../packages/chain/chain-guard.js";
import { assertSelectedProviderChain, getAccount } from "./starknet.js";

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

  it("refuses a deploy without its account key before contacting any RPC", async () => {
    process.env.STARKNET_NETWORK = "mainnet";
    process.env.STARKNET_RPC = "http://127.0.0.1:1";
    process.env.STARKNET_ACCOUNT_ADDRESS = "0x1";
    delete process.env.STARKNET_ACCOUNT_PRIVATE_KEY;

    await expect(getAccount()).rejects.toThrow("Missing required env var STARKNET_ACCOUNT_PRIVATE_KEY");
  });

  it("requires an explicit chain id for custom networks", async () => {
    process.env.STARKNET_NETWORK = "local";
    delete process.env.STARKNET_EXPECTED_CHAIN_ID;
    const provider = { getChainId: async () => "0x123" };

    await expect(assertSelectedProviderChain(provider)).rejects.toThrow("STARKNET_EXPECTED_CHAIN_ID");
  });
});
