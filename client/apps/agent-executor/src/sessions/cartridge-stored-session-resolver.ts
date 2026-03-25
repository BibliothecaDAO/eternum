import { decryptCartridgeSessionMaterial, resolveWorldAuthContext } from "@bibliothecadao/agent-runtime";
import type {
  AgentSessionResolver,
  LoadAgentSessionInput,
  ResolvedAgentSession,
  StoredCartridgeSessionMaterial,
  CartridgeWorldAuthContext,
} from "@bibliothecadao/agent-runtime";

export interface CartridgeStoredResolvedSession extends ResolvedAgentSession {
  accountAddress?: string;
  cartridgeUsername?: string;
  worldAuth?: CartridgeWorldAuthContext;
  material?: StoredCartridgeSessionMaterial;
}

export interface CartridgeStoredSessionLoader {
  load(agentId: string): Promise<{
    status: "pending" | "approved" | "expired" | "revoked" | "invalidated" | "error";
    worldId: string;
    worldName?: string;
    chain?: CartridgeWorldAuthContext["chain"];
    rpcUrl?: string;
    toriiBaseUrl?: string;
    policyFingerprint?: string;
    encryptedSessionJson?: unknown;
    expiresAt?: string;
    sessionAccountAddress?: string;
    cartridgeUsername?: string;
  } | null>;
}

export class CartridgeStoredSessionResolver implements AgentSessionResolver<
  Record<string, unknown>,
  CartridgeStoredResolvedSession
> {
  constructor(
    private readonly loader: CartridgeStoredSessionLoader,
    private readonly encryptionKeys: Record<string, string>,
  ) {}

  async load(input: LoadAgentSessionInput<Record<string, unknown>>): Promise<CartridgeStoredResolvedSession> {
    const stored = await this.loader.load(input.agentId);
    if (!stored) {
      return {
        agentId: input.agentId,
        status: "error",
        metadata: {
          reason: "missing_session",
        },
      } as CartridgeStoredResolvedSession;
    }

    if (stored.status === "expired" || isExpired(stored.expiresAt)) {
      return {
        agentId: input.agentId,
        status: "expired",
        expiresAt: stored.expiresAt,
        metadata: {
          worldId: stored.worldId,
        },
      } as CartridgeStoredResolvedSession;
    }

    if (stored.status === "invalidated") {
      return {
        agentId: input.agentId,
        status: "invalidated",
        expiresAt: stored.expiresAt,
        metadata: {
          worldId: stored.worldId,
        },
      } as CartridgeStoredResolvedSession;
    }

    if (stored.status !== "approved" || !stored.encryptedSessionJson) {
      return {
        agentId: input.agentId,
        status: "pending_auth",
        expiresAt: stored.expiresAt,
        metadata: {
          worldId: stored.worldId,
        },
      } as CartridgeStoredResolvedSession;
    }

    const worldAuth = await resolveWorldAuthContext({
      worldId: stored.worldId,
      worldName: stored.worldName,
      chain: stored.chain,
      rpcUrl: stored.rpcUrl,
      toriiBaseUrl: stored.toriiBaseUrl,
      cartridgeApiBase: process.env.CARTRIDGE_API_BASE,
    });

    if (stored.policyFingerprint && stored.policyFingerprint !== worldAuth.policyFingerprint) {
      return {
        agentId: input.agentId,
        status: "invalidated",
        expiresAt: stored.expiresAt,
        metadata: {
          worldId: stored.worldId,
          reason: "policy_drift",
        },
      } as CartridgeStoredResolvedSession;
    }

    const material = await decryptCartridgeSessionMaterial(stored.encryptedSessionJson as any, {
      keys: this.encryptionKeys,
    });

    return {
      agentId: input.agentId,
      status: "ready",
      accountAddress: stored.sessionAccountAddress ?? material.session.address,
      cartridgeUsername: stored.cartridgeUsername ?? material.session.username,
      expiresAt: stored.expiresAt,
      metadata: {
        worldId: stored.worldId,
      },
      worldAuth,
      material,
    };
  }
}

function isExpired(expiresAt: string | undefined): boolean {
  if (!expiresAt) {
    return false;
  }

  return Date.parse(expiresAt) <= Date.now();
}
