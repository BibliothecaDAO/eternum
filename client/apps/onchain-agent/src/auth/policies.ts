/**
 * Cartridge Controller session policy builder for the Eternum on-chain game.
 *
 * Reads the Dojo deployment manifest and chain-specific address files to build
 * the complete set of contract method policies for an authenticated agent
 * session. Supports mainnet, Sepolia, Slot, Slottest, and local deployments
 * via the {@link Chain} discriminant.
 */

import { getManifest, getAddresses } from "./embedded-data.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported deployment targets, each corresponding to a distinct manifest and address file. */
export type Chain = "mainnet" | "sepolia" | "slot" | "slottest" | "local";

interface Method {
  name: string;
  entrypoint: string;
  description?: string;
}

interface ContractPolicy {
  methods: Method[];
}

/**
 * Mirrors SessionPolicies from @cartridge/presets, which is not directly
 * importable because it is bundled inside @cartridge/controller.
 */
interface SessionPolicies {
  contracts: Record<string, ContractPolicy>;
  messages?: SignMessagePolicy[];
}

interface SignMessagePolicy {
  name: string;
  description?: string;
  types: Record<string, { name: string; type: string }[]>;
  primaryType: string;
  domain: Record<string, string>;
}

/**
 * Optional token contract addresses appended to the session policy.
 *
 * When provided, the corresponding method (`token_lock` or `approve`) is added
 * for that contract so the agent can interact with entry and fee tokens.
 */
export interface TokenAddresses {
  /** Entry token contract address (for `token_lock`). Omit or pass `"0x0"` to skip. */
  entryToken?: string;
  /** Fee token contract address (for `approve`). Omit to skip. */
  feeToken?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mirrors `getContractByName(manifest, "s1_eternum", systemName)` */
function getContractAddress(manifest: { contracts: { tag: string; address: string }[] }, systemName: string): string {
  const tag = `s1_eternum-${systemName}`;
  const entry = manifest.contracts.find((c) => c.tag === tag);
  if (!entry) {
    throw new Error(`Contract not found in manifest: ${tag}`);
  }
  return entry.address;
}

/** Shorthand to build a method entry where name === entrypoint */
function m(entrypoint: string): Method {
  return { name: entrypoint, entrypoint };
}

/** The two standard dojo methods appended to every system contract */
const DOJO_METHODS: Method[] = [m("dojo_name"), m("world_dispatcher")];

function system(manifest: any, systemName: string, methods: Method[]): [string, ContractPolicy] {
  return [getContractAddress(manifest, systemName), { methods: [...methods, ...DOJO_METHODS] }];
}

// ---------------------------------------------------------------------------
// VRF constant
// ---------------------------------------------------------------------------

const VRF_ADDRESS = "0x051fea4450da9d6aee758bdeba88b2f665bcbf549d2c61421aa724e9ac0ced8f";

// ---------------------------------------------------------------------------
// buildPolicies
// ---------------------------------------------------------------------------

/**
 * Build the full Cartridge Controller session policy for the given chain.
 *
 * Reads the Dojo manifest to resolve contract addresses, then builds a
 * {@link SessionPolicies} object covering every system contract the agent may
 * call (troop management, resource transfers, hyperstructures, trading, etc.)
 * plus a message-signing policy for Eternum chat messages.
 *
 * @param chain - Target deployment chain; selects the manifest and address files to load.
 * @param tokens - Optional token contract addresses to include entry/fee token policies.
 * @param manifestOverride - Pre-loaded manifest object; skips reading from disk when provided.
 * @returns A {@link SessionPolicies} object ready to pass to the Cartridge SessionProvider.
 * @throws {Error} If a required contract is not found in the manifest.
 * @throws {Error} If the manifest or addresses file cannot be read or contains invalid JSON.
 */
export function buildPolicies(chain: Chain, tokens?: TokenAddresses, manifestOverride?: any): SessionPolicies {
  const manifest = manifestOverride ?? getManifest(chain);
  const addresses = getAddresses(chain);

  const seasonPassAddress: string = addresses.seasonPass;
  const villagePassAddress: string = addresses.villagePass;

  const contracts: Record<string, ContractPolicy> = {};

  // Helper to add a contract, merging methods if the address already exists
  function add(address: string, policy: ContractPolicy) {
    if (contracts[address]) {
      // Merge: deduplicate by entrypoint
      const existing = new Set(contracts[address].methods.map((m) => m.entrypoint));
      for (const method of policy.methods) {
        if (!existing.has(method.entrypoint)) {
          contracts[address].methods.push(method);
          existing.add(method.entrypoint);
        }
      }
    } else {
      contracts[address] = { methods: [...policy.methods] };
    }
  }

  // -- entryToken (conditional) --
  if (tokens?.entryToken && tokens.entryToken !== "0x0") {
    add(tokens.entryToken, {
      methods: [
        {
          name: "token_lock",
          entrypoint: "token_lock",
          description: "Lock entry token for game participation",
        },
      ],
    });
  }

  // -- feeToken (conditional) --
  if (tokens?.feeToken) {
    add(tokens.feeToken, {
      methods: [
        {
          name: "approve",
          entrypoint: "approve",
          description: "Approve fee token spending",
        },
      ],
    });
  }

  // -- blitz_realm_systems (no dojo methods — matches game client) --
  add(getContractAddress(manifest, "blitz_realm_systems"), {
    methods: [
      m("make_hyperstructures"),
      m("register"),
      m("obtain_entry_token"),
      m("create"),
      m("assign_realm_positions"),
      m("settle_realms"),
    ],
  });

  // -- bank_systems --
  const [bankAddr, bankPolicy] = system(manifest, "bank_systems", [m("create_banks")]);
  add(bankAddr, bankPolicy);

  // -- villagePass: set_approval_for_all --
  add(villagePassAddress, { methods: [m("set_approval_for_all")] });

  // -- config_systems --
  const [configAddr, configPolicy] = system(manifest, "config_systems", [
    m("set_agent_config"),
    m("set_world_config"),
    m("set_mercenaries_name_config"),
    m("set_season_config"),
    m("set_vrf_config"),
    m("set_starting_resources_config"),
    m("set_map_config"),
    m("set_capacity_config"),
    m("set_resource_weight_config"),
    m("set_tick_config"),
    m("set_resource_factory_config"),
    m("set_donkey_speed_config"),
    m("set_battle_config"),
    m("set_hyperstructure_config"),
    m("set_bank_config"),
    m("set_troop_config"),
    m("set_building_config"),
    m("set_building_category_config"),
    m("set_resource_bridge_config"),
    m("set_resource_bridge_fee_split_config"),
    m("set_resource_bridge_whitelist_config"),
    m("set_structure_max_level_config"),
    m("set_structure_level_config"),
    m("set_settlement_config"),
    m("set_trade_config"),
  ]);
  add(configAddr, configPolicy);

  // -- dev_resource_systems --
  const [devResAddr, devResPolicy] = system(manifest, "dev_resource_systems", [m("mint")]);
  add(devResAddr, devResPolicy);

  // -- guild_systems --
  // In the game client, dojo methods appear mid-list then more methods follow.
  // We list all unique methods here; `system()` appends dojo methods at the end
  // and `add()` deduplicates by entrypoint.
  const [guildAddr, guildPolicy] = system(manifest, "guild_systems", [
    m("create_guild"),
    m("join_guild"),
    m("leave_guild"),
    m("whitelist_player"),
    m("transfer_guild_ownership"),
    m("remove_guild_member"),
    m("remove_player_from_whitelist"),
    m("update_whitelist"),
    m("remove_member"),
  ]);
  add(guildAddr, guildPolicy);

  // -- hyperstructure_systems --
  const [hyperAddr, hyperPolicy] = system(manifest, "hyperstructure_systems", [
    m("initialize"),
    m("contribute"),
    m("claim_share_points"),
    m("allocate_shares"),
    m("update_construction_access"),
  ]);
  add(hyperAddr, hyperPolicy);

  // -- liquidity_systems --
  const [liqAddr, liqPolicy] = system(manifest, "liquidity_systems", [m("add"), m("remove")]);
  add(liqAddr, liqPolicy);

  // -- name_systems --
  const [nameAddr, namePolicy] = system(manifest, "name_systems", [m("set_address_name")]);
  add(nameAddr, namePolicy);

  // -- ownership_systems --
  const [ownerAddr, ownerPolicy] = system(manifest, "ownership_systems", [
    m("transfer_structure_ownership"),
    m("transfer_agent_ownership"),
  ]);
  add(ownerAddr, ownerPolicy);

  // -- production_systems --
  const [prodAddr, prodPolicy] = system(manifest, "production_systems", [
    m("create_building"),
    m("destroy_building"),
    m("pause_building_production"),
    m("resume_building_production"),
    m("burn_resource_for_labor_production"),
    m("burn_labor_for_resource_production"),
    m("burn_resource_for_resource_production"),
  ]);
  add(prodAddr, prodPolicy);

  // -- realm_systems --
  const [realmAddr, realmPolicy] = system(manifest, "realm_systems", [m("create")]);
  add(realmAddr, realmPolicy);

  // -- resource_systems --
  // NOTE: The game client has two entries for resource_systems with the same
  // address as separate object keys. In JS the second silently overwrites the
  // first, so the game client loses deposit/withdraw. We intentionally merge
  // both sets here so the agent has the complete policy.
  const [resAddr, resPolicy] = system(manifest, "resource_systems", [m("deposit"), m("withdraw")]);
  add(resAddr, resPolicy);
  // Second set of methods for same contract
  add(getContractAddress(manifest, "resource_systems"), {
    methods: [
      m("approve"),
      m("send"),
      m("pickup"),
      m("arrivals_offload"),
      m("troop_troop_adjacent_transfer"),
      m("troop_structure_adjacent_transfer"),
      m("structure_troop_adjacent_transfer"),
      ...DOJO_METHODS,
      m("structure_burn"),
      m("troop_burn"),
    ],
  });

  // -- relic_systems --
  const [relicAddr, relicPolicy] = system(manifest, "relic_systems", [m("open_chest"), m("apply_relic")]);
  add(relicAddr, relicPolicy);

  // -- season_systems --
  const [seasonAddr, seasonPolicy] = system(manifest, "season_systems", [
    m("register_to_leaderboard"),
    m("claim_leaderboard_rewards"),
  ]);
  add(seasonAddr, seasonPolicy);

  // -- structure_systems --
  const [structAddr, structPolicy] = system(manifest, "structure_systems", [m("level_up")]);
  add(structAddr, structPolicy);

  // -- swap_systems --
  const [swapAddr, swapPolicy] = system(manifest, "swap_systems", [m("buy"), m("sell")]);
  add(swapAddr, swapPolicy);

  // -- trade_systems --
  const [tradeAddr, tradePolicy] = system(manifest, "trade_systems", [
    m("create_order"),
    m("accept_order"),
    m("cancel_order"),
  ]);
  add(tradeAddr, tradePolicy);

  // -- troop_battle_systems --
  const [battleAddr, battlePolicy] = system(manifest, "troop_battle_systems", [
    m("attack_explorer_vs_explorer"),
    m("attack_explorer_vs_guard"),
    m("attack_guard_vs_explorer"),
  ]);
  add(battleAddr, battlePolicy);

  // -- troop_management_systems --
  const [mgmtAddr, mgmtPolicy] = system(manifest, "troop_management_systems", [
    m("guard_add"),
    m("guard_delete"),
    m("explorer_create"),
    m("explorer_add"),
    m("explorer_delete"),
    m("explorer_explorer_swap"),
    m("explorer_guard_swap"),
    m("guard_explorer_swap"),
  ]);
  add(mgmtAddr, mgmtPolicy);

  // -- troop_movement_systems --
  const [moveAddr, movePolicy] = system(manifest, "troop_movement_systems", [
    m("explorer_move"),
    m("explorer_extract_reward"),
  ]);
  add(moveAddr, movePolicy);

  // -- troop_movement_util_systems (dojo methods only) --
  const [moveUtilAddr, moveUtilPolicy] = system(manifest, "troop_movement_util_systems", []);
  add(moveUtilAddr, moveUtilPolicy);

  // -- troop_raid_systems --
  const [raidAddr, raidPolicy] = system(manifest, "troop_raid_systems", [m("raid_explorer_vs_guard")]);
  add(raidAddr, raidPolicy);

  // -- village_systems --
  const [villageAddr, villagePolicy] = system(manifest, "village_systems", [m("upgrade"), m("create")]);
  add(villageAddr, villagePolicy);

  // -- VRF --
  add(VRF_ADDRESS, {
    methods: [
      {
        name: "VRF",
        description: "Verifiable Random Function",
        entrypoint: "request_random",
      },
    ],
  });

  // -- seasonPass: set_approval_for_all --
  add(seasonPassAddress, { methods: [m("set_approval_for_all")] });

  // -- villagePass: set_approval_for_all (second entry, merges with earlier) --
  add(villagePassAddress, { methods: [m("set_approval_for_all")] });

  // -- Message signing policy --
  const messages = [
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
        chainId: chain === "mainnet" ? "SN_MAIN" : "SN_SEPOLIA",
        revision: "1",
      },
    },
  ];

  return { contracts, messages };
}
