import { describe, expect, it } from "vitest";

import { encryptCartridgeSessionMaterial } from "@bibliothecadao/agent-runtime";

import { CartridgeStoredSessionResolver } from "./cartridge-stored-session-resolver";

const ENCRYPTION_KEY = Buffer.from("12345678901234567890123456789012").toString("base64");

describe("cartridge stored session resolver", () => {
  it("loads approved stored sessions into a ready execution session", async () => {
    const encrypted = await encryptCartridgeSessionMaterial(
      {
        signer: { privKey: "priv", pubKey: "pub" },
        session: {
          address: "0xabc",
          ownerGuid: "0xdef",
          expiresAt: String(Math.floor(Date.now() / 1000) + 3600),
          guardianKeyGuid: "0x0",
          metadataHash: "0x0",
          sessionKeyGuid: "0x123",
        },
      },
      {
        activeKeyId: "v1",
        keys: { v1: ENCRYPTION_KEY },
      },
    );

    const resolver = new CartridgeStoredSessionResolver(
      {
        load: async () => ({
          status: "approved",
          worldId: "world-1",
          worldName: "world-1",
          chain: "slot",
          rpcUrl: "https://api.cartridge.gg/x/eternum-blitz-slot-4/katana/rpc/v0_9",
          encryptedSessionJson: encrypted,
          expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        }),
      },
      { v1: ENCRYPTION_KEY },
    );

    const resolved = await resolver.load({ agentId: "agent-1" });
    expect(resolved.status).toBe("ready");
    expect(resolved.material?.signer.privKey).toBe("priv");
    expect(resolved.accountAddress).toBe("0xabc");
  });
});
