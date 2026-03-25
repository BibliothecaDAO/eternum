import {
  buildCartridgeApprovalUrl,
  decryptCartridgeSessionMaterial,
  encryptCartridgeSessionMaterial,
  normalizeCartridgeCallbackPayload,
  resolveWorldAuthContext,
  validateStoredCartridgeSession,
} from "@bibliothecadao/agent-runtime";
import type { CompleteAgentSetupRequest, LaunchMyAgentRequest } from "@bibliothecadao/types";
import { createHash } from "node:crypto";

export async function createPendingCartridgeSession(input: {
  agentId: string;
  authSessionId: string;
  launchRequest: Pick<LaunchMyAgentRequest, "worldId" | "worldName" | "chain" | "rpcUrl" | "toriiBaseUrl">;
  callbackBaseUrl: string;
}) {
  const worldAuth = await resolveWorldAuthContext({
    worldId: input.launchRequest.worldId,
    worldName: input.launchRequest.worldName,
    chain: input.launchRequest.chain,
    rpcUrl: input.launchRequest.rpcUrl,
    toriiBaseUrl: input.launchRequest.toriiBaseUrl,
    cartridgeApiBase: process.env.CARTRIDGE_API_BASE,
  });
  const state = crypto.randomUUID();
  const redirectUri = new URL("/agents/auth/callback", input.callbackBaseUrl);
  redirectUri.hash = new URLSearchParams({
    agentId: input.agentId,
    authSessionId: input.authSessionId,
    state,
  }).toString();

  const approval = await buildCartridgeApprovalUrl({
    keychainUrl: process.env.CARTRIDGE_KEYCHAIN_URL ?? "https://x.cartridge.gg",
    rpcUrl: worldAuth.rpcUrl,
    redirectUri: redirectUri.toString(),
    policies: worldAuth.policies,
  });
  const encryptionConfig = readCartridgeEncryptionConfig();
  const encryptedSignerMaterial = await encryptCartridgeSessionMaterial(
    {
      signer: approval.signer,
      session: {
        address: "0x0",
        ownerGuid: "0x0",
        expiresAt: "0",
        guardianKeyGuid: "0x0",
        metadataHash: "0x0",
        sessionKeyGuid: "0x0",
      },
    },
    encryptionConfig,
  );

  return {
    worldAuth,
    authSession: {
      id: input.authSessionId,
      authUrl: approval.authUrl,
      authState: state,
      sessionRef: approval.sessionRef,
      redirectUri: redirectUri.toString(),
      policyFingerprint: worldAuth.policyFingerprint,
      encryptedSignerJson: encryptedSignerMaterial,
      keyVersion: encryptionConfig.activeKeyId,
    },
  };
}

export async function completePendingCartridgeSession(input: {
  request: CompleteAgentSetupRequest;
  storedSession: {
    callbackStateHash?: string | null;
    policyFingerprint?: string | null;
    encryptedSignerJson?: unknown;
    keyVersion?: string | null;
  };
  launchRequest: {
    worldId: string;
    worldName?: string;
    chain?: "mainnet" | "sepolia" | "slot" | "slottest" | "local";
    rpcUrl?: string;
    toriiBaseUrl?: string;
  };
}) {
  if (sha256Hex(input.request.state) !== input.storedSession.callbackStateHash) {
    throw new Error("Auth state mismatch.");
  }

  const signerMaterial = await decryptStoredSigner(input.storedSession.encryptedSignerJson);
  const worldAuth = await resolveWorldAuthContext({
    worldId: input.launchRequest.worldId,
    worldName: input.launchRequest.worldName,
    chain: input.launchRequest.chain,
    rpcUrl: input.launchRequest.rpcUrl,
    toriiBaseUrl: input.launchRequest.toriiBaseUrl,
    cartridgeApiBase: process.env.CARTRIDGE_API_BASE,
  });

  if (worldAuth.policyFingerprint !== input.storedSession.policyFingerprint) {
    throw new Error("World policy changed before auth completion.");
  }

  const session = normalizeCartridgeCallbackPayload({
    startapp: input.request.startapp,
    signer: signerMaterial.signer,
  });
  const encryptionConfig = readCartridgeEncryptionConfig();
  const encryptedSessionMaterial = await encryptCartridgeSessionMaterial(
    {
      signer: signerMaterial.signer,
      session,
    },
    encryptionConfig,
  );
  const validated =
    process.env.AGENT_AUTH_SKIP_VALIDATE === "true"
      ? {
          accountAddress: session.address,
          username: session.username,
        }
      : await validateStoredCartridgeSession({
          rpcUrl: worldAuth.rpcUrl,
          chainId: worldAuth.chainId,
          policies: worldAuth.policies,
          material: {
            signer: signerMaterial.signer,
            session,
          },
        });

  return {
    worldAuth,
    approvedSession: {
      approvedAt: new Date().toISOString(),
      expiresAt: session.expiresAt ? new Date(Number(session.expiresAt) * 1000).toISOString() : undefined,
      sessionAccountAddress: validated.accountAddress,
      cartridgeUsername: validated.username,
      encryptedSessionJson: encryptedSessionMaterial,
    },
  };
}

function readCartridgeEncryptionConfig() {
  const keys = JSON.parse(process.env.AGENT_SESSION_ENCRYPTION_KEYS ?? "{}") as Record<string, string>;
  const activeKeyId = process.env.AGENT_SESSION_ENCRYPTION_ACTIVE_KEY_ID ?? Object.keys(keys)[0];
  if (!activeKeyId || !keys[activeKeyId]) {
    throw new Error("Agent session encryption keys are not configured.");
  }

  return {
    activeKeyId,
    keys,
  };
}

async function decryptStoredSigner(encryptedSignerJson: unknown) {
  if (!encryptedSignerJson) {
    throw new Error("Missing encrypted signer material.");
  }

  const encryptionConfig = readCartridgeEncryptionConfig();
  return decryptCartridgeSessionMaterial(encryptedSignerJson as any, {
    keys: encryptionConfig.keys,
  });
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
