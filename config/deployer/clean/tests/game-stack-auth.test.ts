import { describe, expect, test } from "bun:test";
import { createBlitzAuthChallenge, verifyCartridgeWalletSignature } from "../game-stack/auth";

describe("Blitz Controller authentication", () => {
  test("binds a short-lived SNIP-12 challenge to one action and payload", () => {
    const challenge = createBlitzAuthChallenge({
      challengeId: `0x${"42".repeat(16)}`,
      requesterWallet: "0x1234",
      action: "create-launch-quote",
      payload: { presetId: "blitz-open" },
      now: new Date("2026-07-18T10:20:00.000Z"),
    });

    expect(challenge).toMatchObject({
      schemaVersion: 1,
      challengeId: `0x${"42".repeat(16)}`,
      requesterWallet: "0x1234",
      action: "create-launch-quote",
      payload: { presetId: "blitz-open" },
      expiresAt: "2026-07-18T10:25:00.000Z",
    });
    expect(challenge.messageHash).toMatch(/^0x[0-9a-f]+$/);
    expect(challenge.typedData.primaryType).toBe("EternumBlitzLaunch");
    expect(challenge.typedData.message).toMatchObject({
      action: "create-launch-quote",
      challenge_id: `0x${"42".repeat(16)}`,
      requester_wallet: "0x1234",
    });
  });

  test("accepts only the SNIP-6 VALID response from the requested Controller account", async () => {
    let rpcBody: Record<string, unknown> | undefined;
    const isValid = await verifyCartridgeWalletSignature({
      rpcUrl: "https://rpc.example",
      requesterWallet: "0x1234",
      messageHash: "0x5678",
      signature: ["0x9", "0xa"],
      fetchImpl: async (_input, init) => {
        rpcBody = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: ["0x56414c4944"] }));
      },
    });

    expect(isValid).toBe(true);
    expect(rpcBody).toMatchObject({
      method: "starknet_call",
      params: {
        request: {
          contract_address: "0x1234",
          calldata: ["0x5678", "0x2", "0x9", "0xa"],
        },
        block_id: "latest",
      },
    });
  });

  test("rejects an invalid account response", async () => {
    const isValid = await verifyCartridgeWalletSignature({
      rpcUrl: "https://rpc.example",
      requesterWallet: "0x1234",
      messageHash: "0x5678",
      signature: ["0x9", "0xa"],
      fetchImpl: async () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: ["0x0"] })),
    });

    expect(isValid).toBe(false);
  });
});
