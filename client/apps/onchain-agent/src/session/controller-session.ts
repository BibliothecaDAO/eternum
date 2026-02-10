import { execFile } from "node:child_process";
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

const POLICY_METHODS_BY_SUFFIX: Record<string, Array<{ name: string; entrypoint: string; description: string }>> = {
  resource_systems: [
    { name: "send", entrypoint: "send", description: "Send resources between structures" },
    { name: "pickup", entrypoint: "pickup", description: "Pick up resources from a structure" },
    { name: "arrivals_offload", entrypoint: "arrivals_offload", description: "Claim incoming arrivals" },
  ],
  troop_management_systems: [
    { name: "explorer_create", entrypoint: "explorer_create", description: "Create explorer troops" },
    { name: "explorer_add", entrypoint: "explorer_add", description: "Add troops to an explorer" },
    { name: "explorer_delete", entrypoint: "explorer_delete", description: "Delete an explorer" },
    { name: "guard_add", entrypoint: "guard_add", description: "Add guard troops to a structure" },
    { name: "guard_delete", entrypoint: "guard_delete", description: "Delete guard troops from a structure" },
    {
      name: "explorer_explorer_swap",
      entrypoint: "explorer_explorer_swap",
      description: "Swap troops between explorers",
    },
    { name: "explorer_guard_swap", entrypoint: "explorer_guard_swap", description: "Swap explorer troops to guard" },
    { name: "guard_explorer_swap", entrypoint: "guard_explorer_swap", description: "Swap guard troops to explorer" },
  ],
  troop_movement_systems: [
    { name: "explorer_move", entrypoint: "explorer_move", description: "Move explorer troops" },
    { name: "explorer_extract_reward", entrypoint: "explorer_extract_reward", description: "Extract explore reward" },
  ],
  troop_battle_systems: [
    {
      name: "attack_explorer_vs_explorer",
      entrypoint: "attack_explorer_vs_explorer",
      description: "Attack an enemy explorer",
    },
    {
      name: "attack_explorer_vs_guard",
      entrypoint: "attack_explorer_vs_guard",
      description: "Attack an enemy guard with an explorer",
    },
    {
      name: "attack_guard_vs_explorer",
      entrypoint: "attack_guard_vs_explorer",
      description: "Attack an explorer with a guard",
    },
  ],
  troop_raid_systems: [
    { name: "raid_explorer_vs_guard", entrypoint: "raid_explorer_vs_guard", description: "Raid guarded structure" },
  ],
  trade_systems: [
    { name: "create_order", entrypoint: "create_order", description: "Create trade order" },
    { name: "accept_order", entrypoint: "accept_order", description: "Accept trade order" },
    { name: "cancel_order", entrypoint: "cancel_order", description: "Cancel trade order" },
  ],
  production_systems: [
    { name: "create_building", entrypoint: "create_building", description: "Create building" },
    { name: "destroy_building", entrypoint: "destroy_building", description: "Destroy building" },
    { name: "pause_building_production", entrypoint: "pause_building_production", description: "Pause production" },
    {
      name: "resume_building_production",
      entrypoint: "resume_building_production",
      description: "Resume production",
    },
  ],
  bank_systems: [
    { name: "buy", entrypoint: "buy", description: "Buy resources from bank" },
    { name: "sell", entrypoint: "sell", description: "Sell resources to bank" },
  ],
  liquidity_systems: [
    { name: "add", entrypoint: "add", description: "Add liquidity to pool" },
    { name: "remove", entrypoint: "remove", description: "Remove liquidity from pool" },
  ],
  guild_systems: [
    { name: "create_guild", entrypoint: "create_guild", description: "Create guild" },
    { name: "join_guild", entrypoint: "join_guild", description: "Join guild" },
    { name: "leave_guild", entrypoint: "leave_guild", description: "Leave guild" },
    { name: "update_whitelist", entrypoint: "update_whitelist", description: "Update guild whitelist" },
  ],
  realm_systems: [{ name: "level_up", entrypoint: "level_up", description: "Upgrade realm level" }],
  hyperstructure_systems: [
    {
      name: "contribute",
      entrypoint: "contribute",
      description: "Contribute resources to hyperstructure",
    },
  ],
};

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
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^s\d+_/, "");
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

export function buildSessionPoliciesFromManifest(
  manifest: SessionManifest,
  options: BuildSessionPolicyOptions = {},
): SessionPolicies {
  const contracts: Record<string, { methods: Array<{ name: string; entrypoint: string; description: string }> }> = {};
  const entries = Array.isArray(manifest.contracts) ? manifest.contracts : [];
  const gameName = normalizeGameName(options.gameName);

  for (const contract of entries) {
    const item = contract as Record<string, unknown>;
    const tag = normalizeTag(item.tag);
    const address = normalizeAddress(item.address);
    if (!tag || !address) continue;
    if (!tagMatchesGame(tag, gameName)) continue;

    for (const [suffix, methods] of Object.entries(POLICY_METHODS_BY_SUFFIX)) {
      if (!(tag === suffix || tag.endsWith(`-${suffix}`) || tag.includes(suffix))) {
        continue;
      }

      const existing = contracts[address]?.methods ?? [];
      const mergedByEntrypoint = new Map<string, { name: string; entrypoint: string; description: string }>();
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
  }

  if (Object.keys(contracts).length === 0) {
    const gameSuffix = gameName ? ` for game '${gameName}'` : "";
    throw new Error(
      `Could not derive Controller session policies from manifest${gameSuffix}: no recognized system contracts found`,
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

    // Patch openLink to actually open the browser instead of just printing the URL
    const backend = (this.provider as any)._backend;
    if (backend) {
      backend.openLink = (url: string) => {
        const openCmd = process.platform === "darwin" ? "open" : "xdg-open";
        execFile(openCmd, [url]);
      };
    }
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
