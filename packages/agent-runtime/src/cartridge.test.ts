import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import {
  buildCartridgeApprovalUrl,
  computeCartridgePolicyFingerprint,
  decryptCartridgeSessionMaterial,
  encryptCartridgeSessionMaterial,
  materializeCartridgeSessionFiles,
  normalizeCartridgeCallbackPayload,
} from "./index";

describe("cartridge auth helpers", () => {
  it("builds a keychain approval URL with the expected query parameters", async () => {
    const approval = await buildCartridgeApprovalUrl({
      keychainUrl: "https://x.cartridge.gg",
      rpcUrl: "https://rpc.example",
      redirectUri: "https://game.example/agents/auth/callback?agentId=agent-1&state=state-1",
      policies: {
        contracts: {
          "0x123": {
            methods: [{ name: "move", entrypoint: "move" }],
          },
        },
      },
    });

    const url = new URL(approval.authUrl);
    expect(url.origin).toBe("https://x.cartridge.gg");
    expect(url.searchParams.get("public_key")).toBeTruthy();
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://game.example/agents/auth/callback?agentId=agent-1&state=state-1",
    );
    expect(url.searchParams.get("redirect_query_name")).toBe("startapp");
    expect(url.searchParams.get("policies")).toContain("move");
    expect(url.searchParams.get("rpc_url")).toBe("https://rpc.example");
    expect(approval.signer.privKey).toBeTruthy();
  });

  it("normalizes callback payloads using sdk-compatible casing and signer guid derivation", async () => {
    const approval = await buildCartridgeApprovalUrl({
      keychainUrl: "https://x.cartridge.gg",
      rpcUrl: "https://rpc.example",
      redirectUri: "https://game.example/agents/auth/callback?agentId=agent-1&state=state-1",
      policies: { contracts: {} },
    });

    const normalized = normalizeCartridgeCallbackPayload({
      startapp: btoa(
        JSON.stringify({
          username: "player_one",
          address: "0xABCDEF",
          ownerGuid: "0x123456",
          expiresAt: "9999999999",
        }),
      ),
      signer: approval.signer,
    });

    expect(normalized.address).toBe("0xabcdef");
    expect(normalized.ownerGuid).toBe("0x123456");
    expect(normalized.guardianKeyGuid).toBe("0x0");
    expect(normalized.metadataHash).toBe("0x0");
    expect(normalized.sessionKeyGuid).toMatch(/^0x/i);
  });

  it("encrypts and decrypts stored session material", async () => {
    const encrypted = await encryptCartridgeSessionMaterial(
      {
        signer: { privKey: "priv", pubKey: "pub" },
        session: { address: "0xabc", ownerGuid: "0xdef", expiresAt: "123" },
      },
      {
        activeKeyId: "v1",
        keys: {
          v1: Buffer.from("12345678901234567890123456789012").toString("base64"),
        },
      },
    );

    const decrypted = await decryptCartridgeSessionMaterial(encrypted, {
      keys: {
        v1: Buffer.from("12345678901234567890123456789012").toString("base64"),
      },
    });

    expect(decrypted.signer.privKey).toBe("priv");
    expect(decrypted.session.address).toBe("0xabc");
  });

  it("materializes the node controller session file shape", async () => {
    const basePath = await mkdtemp(join(tmpdir(), "agent-runtime-cartridge-test-"));

    try {
      await materializeCartridgeSessionFiles({
        basePath,
        material: {
          signer: { privKey: "priv", pubKey: "pub" },
          session: {
            address: "0xabc",
            ownerGuid: "0xdef",
            expiresAt: "123",
            guardianKeyGuid: "0x0",
            metadataHash: "0x0",
            sessionKeyGuid: "0x456",
          },
        },
      });

      const payload = JSON.parse(await readFile(join(basePath, "session.json"), "utf8")) as Record<string, unknown>;
      expect(payload.signer).toEqual({ privKey: "priv", pubKey: "pub" });
      expect(payload.session).toMatchObject({ address: "0xabc", ownerGuid: "0xdef" });
    } finally {
      await rm(basePath, { recursive: true, force: true });
    }
  });

  it("changes policy fingerprints when world auth context changes", async () => {
    const left = computeCartridgePolicyFingerprint({
      chain: "slot",
      chainId: "SN_MAIN",
      rpcUrl: "https://rpc-a.example",
      worldAddress: "0x111",
      policies: { contracts: { "0x1": { methods: [{ name: "move", entrypoint: "move" }] } } },
    });
    const right = computeCartridgePolicyFingerprint({
      chain: "slot",
      chainId: "SN_MAIN",
      rpcUrl: "https://rpc-b.example",
      worldAddress: "0x111",
      policies: { contracts: { "0x1": { methods: [{ name: "move", entrypoint: "move" }] } } },
    });

    expect(left).not.toBe(right);
  });
});
