import { execFile } from "node:child_process";
import SessionProvider from "@cartridge/controller/session/node";
import type { WalletAccount } from "starknet";
import type { WorldProfile } from "../world/types";

type SessionPolicies = ConstructorParameters<typeof SessionProvider>[0]["policies"];

type PolicyMethod = { name: string; entrypoint: string; description?: string };

interface SessionManifest {
  contracts?: unknown[];
}

interface ControllerSessionConfig {
  rpcUrl: string;
  chainId: string;
  gameName?: string;
  basePath?: string;
  manifest: SessionManifest;
  worldProfile?: WorldProfile;
}

interface BuildSessionPolicyOptions {
  gameName?: string;
  worldProfile?: WorldProfile;
}

const DOJO_INTROSPECTION: PolicyMethod[] = [
  { name: "dojo_name", entrypoint: "dojo_name" },
  { name: "world_dispatcher", entrypoint: "world_dispatcher" },
];

const VRF_PROVIDER_ADDRESS = "0x051fea4450da9d6aee758bdeba88b2f665bcbf549d2c61421aa724e9ac0ced8f";

const POLICY_METHODS_BY_SUFFIX: Record<string, PolicyMethod[]> = {
  resource_systems: [
    { name: "approve", entrypoint: "approve", description: "Approve resource transfer" },
    { name: "send", entrypoint: "send", description: "Send resources between structures" },
    { name: "pickup", entrypoint: "pickup", description: "Pick up resources from a structure" },
    { name: "arrivals_offload", entrypoint: "arrivals_offload", description: "Claim incoming arrivals" },
    { name: "deposit", entrypoint: "deposit", description: "Deposit resources" },
    { name: "withdraw", entrypoint: "withdraw", description: "Withdraw resources" },
    {
      name: "troop_troop_adjacent_transfer",
      entrypoint: "troop_troop_adjacent_transfer",
      description: "Transfer between adjacent troops",
    },
    {
      name: "troop_structure_adjacent_transfer",
      entrypoint: "troop_structure_adjacent_transfer",
      description: "Transfer from troop to structure",
    },
    {
      name: "structure_troop_adjacent_transfer",
      entrypoint: "structure_troop_adjacent_transfer",
      description: "Transfer from structure to troop",
    },
    { name: "structure_burn", entrypoint: "structure_burn", description: "Burn structure resources" },
    { name: "troop_burn", entrypoint: "troop_burn", description: "Burn troop resources" },
    ...DOJO_INTROSPECTION,
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
    ...DOJO_INTROSPECTION,
  ],
  troop_movement_systems: [
    { name: "explorer_move", entrypoint: "explorer_move", description: "Move explorer troops" },
    { name: "explorer_extract_reward", entrypoint: "explorer_extract_reward", description: "Extract explore reward" },
    ...DOJO_INTROSPECTION,
  ],
  troop_movement_util_systems: [...DOJO_INTROSPECTION],
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
    ...DOJO_INTROSPECTION,
  ],
  troop_raid_systems: [
    { name: "raid_explorer_vs_guard", entrypoint: "raid_explorer_vs_guard", description: "Raid guarded structure" },
    ...DOJO_INTROSPECTION,
  ],
  trade_systems: [
    { name: "create_order", entrypoint: "create_order", description: "Create trade order" },
    { name: "accept_order", entrypoint: "accept_order", description: "Accept trade order" },
    { name: "cancel_order", entrypoint: "cancel_order", description: "Cancel trade order" },
    ...DOJO_INTROSPECTION,
  ],
  production_systems: [
    { name: "create_building", entrypoint: "create_building", description: "Create building" },
    { name: "destroy_building", entrypoint: "destroy_building", description: "Destroy building" },
    { name: "pause_building_production", entrypoint: "pause_building_production", description: "Pause production" },
    { name: "resume_building_production", entrypoint: "resume_building_production", description: "Resume production" },
    {
      name: "burn_resource_for_labor_production",
      entrypoint: "burn_resource_for_labor_production",
      description: "Burn resource for labor",
    },
    {
      name: "burn_labor_for_resource_production",
      entrypoint: "burn_labor_for_resource_production",
      description: "Burn labor for resource",
    },
    {
      name: "burn_resource_for_resource_production",
      entrypoint: "burn_resource_for_resource_production",
      description: "Burn resource for resource",
    },
    ...DOJO_INTROSPECTION,
  ],
  swap_systems: [
    { name: "buy", entrypoint: "buy", description: "Buy resources from bank" },
    { name: "sell", entrypoint: "sell", description: "Sell resources to bank" },
    ...DOJO_INTROSPECTION,
  ],
  bank_systems: [
    { name: "create_banks", entrypoint: "create_banks", description: "Create banks" },
    ...DOJO_INTROSPECTION,
  ],
  liquidity_systems: [
    { name: "add", entrypoint: "add", description: "Add liquidity to pool" },
    { name: "remove", entrypoint: "remove", description: "Remove liquidity from pool" },
    ...DOJO_INTROSPECTION,
  ],
  guild_systems: [
    { name: "create_guild", entrypoint: "create_guild", description: "Create guild" },
    { name: "join_guild", entrypoint: "join_guild", description: "Join guild" },
    { name: "leave_guild", entrypoint: "leave_guild", description: "Leave guild" },
    { name: "whitelist_player", entrypoint: "whitelist_player", description: "Whitelist player" },
    {
      name: "transfer_guild_ownership",
      entrypoint: "transfer_guild_ownership",
      description: "Transfer guild ownership",
    },
    { name: "remove_guild_member", entrypoint: "remove_guild_member", description: "Remove guild member" },
    {
      name: "remove_player_from_whitelist",
      entrypoint: "remove_player_from_whitelist",
      description: "Remove player from whitelist",
    },
    { name: "update_whitelist", entrypoint: "update_whitelist", description: "Update guild whitelist" },
    { name: "remove_member", entrypoint: "remove_member", description: "Remove member" },
    ...DOJO_INTROSPECTION,
  ],
  realm_systems: [{ name: "create", entrypoint: "create", description: "Create realm" }, ...DOJO_INTROSPECTION],
  structure_systems: [
    { name: "level_up", entrypoint: "level_up", description: "Upgrade structure level" },
    ...DOJO_INTROSPECTION,
  ],
  hyperstructure_systems: [
    { name: "initialize", entrypoint: "initialize", description: "Initialize hyperstructure" },
    { name: "contribute", entrypoint: "contribute", description: "Contribute resources to hyperstructure" },
    { name: "claim_share_points", entrypoint: "claim_share_points", description: "Claim share points" },
    { name: "allocate_shares", entrypoint: "allocate_shares", description: "Allocate shares" },
    {
      name: "update_construction_access",
      entrypoint: "update_construction_access",
      description: "Update construction access",
    },
    ...DOJO_INTROSPECTION,
  ],
  config_systems: [
    { name: "set_agent_config", entrypoint: "set_agent_config", description: "Set agent config" },
    { name: "set_world_config", entrypoint: "set_world_config", description: "Set world config" },
    ...DOJO_INTROSPECTION,
  ],
  name_systems: [
    { name: "set_address_name", entrypoint: "set_address_name", description: "Set address name" },
    ...DOJO_INTROSPECTION,
  ],
  ownership_systems: [
    {
      name: "transfer_structure_ownership",
      entrypoint: "transfer_structure_ownership",
      description: "Transfer structure ownership",
    },
    {
      name: "transfer_agent_ownership",
      entrypoint: "transfer_agent_ownership",
      description: "Transfer agent ownership",
    },
    ...DOJO_INTROSPECTION,
  ],
  dev_resource_systems: [
    { name: "mint", entrypoint: "mint", description: "Mint dev resources" },
    ...DOJO_INTROSPECTION,
  ],
  relic_systems: [
    { name: "open_chest", entrypoint: "open_chest", description: "Open relic chest" },
    { name: "apply_relic", entrypoint: "apply_relic", description: "Apply relic" },
    ...DOJO_INTROSPECTION,
  ],
  season_systems: [
    { name: "register_to_leaderboard", entrypoint: "register_to_leaderboard", description: "Register to leaderboard" },
    {
      name: "claim_leaderboard_rewards",
      entrypoint: "claim_leaderboard_rewards",
      description: "Claim leaderboard rewards",
    },
    ...DOJO_INTROSPECTION,
  ],
  village_systems: [
    { name: "upgrade", entrypoint: "upgrade", description: "Upgrade village" },
    { name: "create", entrypoint: "create", description: "Create village" },
    ...DOJO_INTROSPECTION,
  ],
  blitz_realm_systems: [
    { name: "make_hyperstructures", entrypoint: "make_hyperstructures", description: "Make hyperstructures" },
    { name: "register", entrypoint: "register", description: "Register for blitz" },
    { name: "obtain_entry_token", entrypoint: "obtain_entry_token", description: "Obtain entry token" },
    { name: "create", entrypoint: "create", description: "Create blitz realm" },
    { name: "assign_realm_positions", entrypoint: "assign_realm_positions", description: "Assign realm positions" },
    { name: "settle_realms", entrypoint: "settle_realms", description: "Settle realms" },
    ...DOJO_INTROSPECTION,
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

function buildMessageSigningPolicy(chain: string): Array<Record<string, unknown>> {
  const chainDomain = chain === "mainnet" ? "SN_MAIN" : "SN_SEPOLIA";
  return [
    {
      name: "Eternum Message Signing",
      description: "Allows signing messages for Eternum",
      types: {
        StarknetDomain: [
          { name: "name", type: "shortstring" },
          { name: "version", type: "shortstring" },
          { name: "chainId", type: "shortstring" },
          { name: "revision", type: "shortstring" },
        ],
        "s1_eternum-Message": [
          { name: "identity", type: "ContractAddress" },
          { name: "channel", type: "shortstring" },
          { name: "content", type: "string" },
          { name: "timestamp", type: "felt" },
          { name: "salt", type: "felt" },
        ],
      },
      primaryType: "s1_eternum-Message",
      domain: {
        name: "Eternum",
        version: "1",
        chainId: chainDomain,
        revision: "1",
      },
    },
  ];
}

export function buildSessionPoliciesFromManifest(
  manifest: SessionManifest,
  options: BuildSessionPolicyOptions = {},
): SessionPolicies {
  const contracts: Record<string, { methods: PolicyMethod[] }> = {};
  const entries = Array.isArray(manifest.contracts) ? manifest.contracts : [];
  const gameName = normalizeGameName(options.gameName);
  const profile = options.worldProfile;

  for (const contract of entries) {
    const item = contract as Record<string, unknown>;
    const tag = normalizeTag(item.tag);
    const address = normalizeAddress(item.address);
    if (!tag || !address) continue;
    if (!tagMatchesGame(tag, gameName)) continue;

    for (const [suffix, methods] of Object.entries(POLICY_METHODS_BY_SUFFIX)) {
      if (!(tag === suffix || tag.endsWith(`-${suffix}`))) {
        continue;
      }

      const existing = contracts[address]?.methods ?? [];
      const mergedByEntrypoint = new Map<string, PolicyMethod>();
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

  // Add VRF provider policy
  contracts[VRF_PROVIDER_ADDRESS] = {
    methods: [{ name: "VRF", entrypoint: "request_random", description: "Verifiable Random Function" }],
  };

  // Add token policies from WorldProfile
  if (profile?.entryTokenAddress && profile.entryTokenAddress !== "0x0") {
    contracts[profile.entryTokenAddress] = {
      methods: [{ name: "token_lock", entrypoint: "token_lock" }],
    };
  }
  if (profile?.feeTokenAddress) {
    contracts[profile.feeTokenAddress] = {
      methods: [{ name: "approve", entrypoint: "approve" }],
    };
  }

  if (Object.keys(contracts).length === 0) {
    const gameSuffix = gameName ? ` for game '${gameName}'` : "";
    throw new Error(
      `Could not derive Controller session policies from manifest${gameSuffix}: no recognized system contracts found`,
    );
  }

  const chain = profile?.chain ?? "slot";
  return { contracts, messages: buildMessageSigningPolicy(chain) } as SessionPolicies;
}

export class ControllerSession {
  private provider: SessionProvider;

  constructor(config: ControllerSessionConfig) {
    const policies = buildSessionPoliciesFromManifest(config.manifest, {
      gameName: config.gameName,
      worldProfile: config.worldProfile,
    });
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
        console.log(`\n  🔗 APPROVE SESSION: ${url}\n`);
        // Also try opening browser (will fail silently on headless)
        const openCmd = process.platform === "darwin" ? "open" : "xdg-open";
        execFile(openCmd, [url], () => {});
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
