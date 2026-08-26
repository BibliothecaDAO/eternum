// @vitest-environment node

import { describe, expect, it } from "vitest";
import { RpcProvider } from "starknet";

import { createAppchainFaucetAccount } from "./appchain-faucet-account";

describe("createAppchainFaucetAccount", () => {
  it("constructs the configured appchain fee-token faucet", () => {
    const account = createAppchainFaucetAccount(new RpcProvider({ nodeUrl: "https://rpc.example" }), {
      address: "0x123",
      privateKey: "0x456",
    });

    expect(account.address).toBe("0x123");
  });

  it("refuses incomplete faucet credentials", () => {
    expect(() =>
      createAppchainFaucetAccount(new RpcProvider({ nodeUrl: "https://rpc.example" }), {
        address: "0x123",
        privateKey: undefined,
      }),
    ).toThrow("Appchain fee-token faucet credentials are not configured");
  });
});
