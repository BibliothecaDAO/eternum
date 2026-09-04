import { buildSiwsMessage } from "@realms-world/identity";
import { typedData } from "starknet";
import { describe, expect, it } from "vitest";

// The strictest SNIP-12 encoder available in CI: starknet.js must hash the exact message we sign.
// Controller's account-wasm rejected the previous revision-1 definitions ("string" domain members),
// so any drift in the type definitions has to fail here before it reaches a wallet.
describe("siws typed data hashing", () => {
  it("hashes under strict revision-1 encoding, including a 64-char hex nonce", () => {
    const message = buildSiwsMessage({
      address: "0x0123",
      chainId: "SN_MAIN",
      domain: "realms.test",
      nonce: "f".repeat(64),
      uri: "https://realms.test",
      issuedAt: "2026-08-26T12:00:00.000Z",
    });
    const hash = typedData.getMessageHash(message, "0x0123");
    expect(hash).toMatch(/^0x[0-9a-f]+$/);
  });
});
