import { describe, expect, it } from "vitest";
import { createPrivateKeyAccount } from "../../src/session/privatekey-auth";

describe("privatekey-auth", () => {
  it("creates an Account with the given rpc, key, and address", () => {
    const account = createPrivateKeyAccount(
      "http://localhost:5050",
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
    );
    expect(account).toBeDefined();
    expect(account.address).toBe("0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7");
  });

  it("throws when private key is missing", () => {
    expect(() => createPrivateKeyAccount("http://localhost:5050", "", "0xdeadbeef")).toThrow("PRIVATE_KEY");
  });

  it("throws when address is missing", () => {
    expect(() => createPrivateKeyAccount("http://localhost:5050", "0x1234", "")).toThrow("ACCOUNT_ADDRESS");
  });
});
