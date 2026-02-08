import SessionProvider from "@cartridge/controller/session/node";
import type { WalletAccount } from "starknet";

type SessionPolicies = ConstructorParameters<typeof SessionProvider>[0]["policies"];

interface SessionManifest {
  contracts?: unknown[];
}

export interface ControllerSessionConfig {
  rpcUrl: string;
  chainId: string;
  gameName?: string;
  basePath?: string;
  manifest: SessionManifest;
}

export interface BuildSessionPolicyOptions {
  gameName?: string;
}

function normalizeTag(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeGameName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/^s\d+_/, "");
  return normalized || null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tagMatchesGame(tag: string, gameName: string | null): boolean {
  if (!gameName) return true;
  const pattern = new RegExp(`(?:^|_)${escapeRegExp(gameName)}-`);
  return pattern.test(tag);
}

/**
 * Build session policies by reading the `systems` array from each manifest contract.
 * Every entry in `systems` becomes an allowed entrypoint for that contract's address.
 * This automatically stays in sync with deployed contracts — no hardcoded method lists.
 */
export function buildSessionPoliciesFromManifest(
  manifest: SessionManifest,
  options: BuildSessionPolicyOptions = {},
): SessionPolicies {
  const contracts: Record<string, { methods: Array<{ name: string; entrypoint: string }> }> = {};
  const entries = Array.isArray(manifest.contracts) ? manifest.contracts : [];
  const gameName = normalizeGameName(options.gameName);

  for (const contract of entries) {
    const item = contract as Record<string, unknown>;
    const tag = normalizeTag(item.tag);
    const address = normalizeAddress(item.address);
    if (!tag || !address) continue;
    if (!tagMatchesGame(tag, gameName)) continue;

    const systems = Array.isArray(item.systems) ? item.systems : [];
    const methods: Array<{ name: string; entrypoint: string }> = [];
    for (const system of systems) {
      // Skip "upgrade" — it's a Dojo framework admin entrypoint, not a player action
      if (typeof system === "string" && system.length > 0 && system !== "upgrade") {
        methods.push({ name: system, entrypoint: system });
      }
    }

    if (methods.length === 0) continue;

    const existing = contracts[address]?.methods ?? [];
    const mergedByEntrypoint = new Map<string, { name: string; entrypoint: string }>();
    for (const method of existing) {
      mergedByEntrypoint.set(method.entrypoint, method);
    }
    for (const method of methods) {
      mergedByEntrypoint.set(method.entrypoint, method);
    }

    contracts[address] = {
      methods: Array.from(mergedByEntrypoint.values()),
    };
  }

  if (Object.keys(contracts).length === 0) {
    const gameSuffix = gameName ? ` for game '${gameName}'` : "";
    throw new Error(
      `Could not derive Controller session policies from manifest${gameSuffix}: no system contracts with entrypoints found`,
    );
  }

  return { contracts };
}

export class ControllerSession {
  private provider: SessionProvider;

  constructor(config: ControllerSessionConfig) {
    const policies = buildSessionPoliciesFromManifest(config.manifest, { gameName: config.gameName });
    this.provider = new SessionProvider({
      rpc: config.rpcUrl,
      chainId: config.chainId,
      policies,
      basePath: config.basePath ?? ".cartridge",
    });
  }

  /**
   * Check for an existing valid session on disk.
   * Returns the account if a session exists and hasn't expired, null otherwise.
   * Does NOT trigger the browser auth flow.
   */
  async probe(): Promise<WalletAccount | null> {
    const account = await this.provider.probe();
    return account ?? null;
  }

  /**
   * Connect to the Cartridge Controller.
   *
   * 1. Checks for an existing session on disk (probe).
   * 2. If none, prints an auth URL to stdout and waits up to 5 minutes
   *    for the human to approve in their browser.
   * 3. Returns the session account once authorized.
   *
   * Throws if the callback times out or the session cannot be established.
   */
  async connect(): Promise<WalletAccount> {
    const account = await this.provider.connect();
    if (!account) {
      throw new Error(
        "Controller session not established. The human must open the printed URL and approve the session.",
      );
    }
    return account;
  }

  /**
   * Clear the stored session. Next connect() will require re-authorization.
   */
  async disconnect(): Promise<void> {
    await this.provider.disconnect();
  }
}
