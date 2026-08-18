import { namespaceForChain } from "@/dojo/game-scope";
import { getActiveWorld, resolveRuntimeChain } from "@/runtime/world";
import { getSeasonPassAddress, getVillagePassAddress } from "@/utils/addresses";
import { Chain } from "@contracts";
import { toSessionPolicies } from "@cartridge/controller";
import { getContractByName } from "@dojoengine/core";
import { dojoConfig } from "../../../dojo-config";
import { env } from "../../../env";
import { buildSigningMessages } from "./signing-policy";

const seasonPassMethodPolicies = [
  {
    name: "approve",
    entrypoint: "approve",
  },
  {
    name: "set_approval_for_all",
    entrypoint: "set_approval_for_all",
  },
];

// Cartridge deprecates ERC-20 approve policies without an explicit spender and
// amount ("will be rejected in future versions"). The spender is the contract
// the settle flow approves (see buildBlitzSettleCalls); the cap is 2000 STRK —
// the chain currently charges no fees, so this only bounds session authority.
const FEE_TOKEN_APPROVE_CAP = "0x6c6b935b8bbd400000";

const buildFeeTokenPolicies = (feeTokenAddress: string | null | undefined, spenderAddress: string) =>
  feeTokenAddress
    ? {
        [feeTokenAddress]: {
          methods: [
            {
              name: "approve",
              entrypoint: "approve",
              spender: spenderAddress,
              amount: FEE_TOKEN_APPROVE_CAP,
            },
          ],
        },
      }
    : {};

const buildEntryTokenPolicies = (entryTokenAddress: string | null | undefined) =>
  entryTokenAddress
    ? {
        [entryTokenAddress]: {
          methods: [
            {
              name: "set_approval_for_all",
              entrypoint: "set_approval_for_all",
            },
          ],
        },
      }
    : {};

const resolvePolicyChain = (): Chain => resolveRuntimeChain(env.VITE_PUBLIC_CHAIN as Chain);

// Contracts absent from the active manifest (e.g. config_systems on s2)
// resolve to "" and are pruned from the policy map before submission.
const contractAddress = (manifest: unknown, name: string): string =>
  (getContractByName(manifest, namespaceForChain(resolvePolicyChain()), name) as { address?: string } | undefined)
    ?.address ?? "";

const resolveSeasonPassAddresses = (chain: Chain): string[] =>
  Array.from(new Set([getSeasonPassAddress(chain)])).filter((address): address is string =>
    Boolean(address && address !== "0x0"),
  );

const buildSeasonPassPolicies = (chain: Chain) =>
  Object.fromEntries(
    resolveSeasonPassAddresses(chain).map((address) => [
      address,
      {
        methods: seasonPassMethodPolicies,
      },
    ]),
  );

const buildActiveWorldTokenPolicies = (manifest: unknown) => {
  const activeWorld = getActiveWorld();
  const feeTokenAddress = activeWorld?.feeTokenAddress || env.VITE_PUBLIC_FEE_TOKEN_ADDRESS;
  const entryTokenAddress = activeWorld?.entryTokenAddress || null;

  return {
    feeTokenPolicies: buildFeeTokenPolicies(feeTokenAddress, contractAddress(manifest, "blitz_realm_systems")),
    entryTokenPolicies: buildEntryTokenPolicies(entryTokenAddress),
  };
};

export const buildPolicies = (manifest: any) => {
  const chain = resolvePolicyChain();
  const { feeTokenPolicies, entryTokenPolicies } = buildActiveWorldTokenPolicies(manifest);
  const seasonPassPolicies = buildSeasonPassPolicies(chain);
  const villagePassAddress = getVillagePassAddress(chain);

  const contracts: Record<string, unknown> = {
    ...feeTokenPolicies,
    ...entryTokenPolicies,
    ...seasonPassPolicies,
    [contractAddress(manifest, "blitz_realm_systems")]: {
      methods: [
        {
          name: "obtain_entry_token",
          entrypoint: "obtain_entry_token",
        },
        {
          name: "settle",
          entrypoint: "settle",
        },
        {
          name: "provision_realm",
          entrypoint: "provision_realm",
        },
      ],
    },
    [contractAddress(manifest, "hyperstructure_create_systems")]: {
      methods: [
        {
          name: "create_hyperstructure",
          entrypoint: "create_hyperstructure",
        },
      ],
    },
    [contractAddress(manifest, "bank_systems")]: {
      methods: [
        {
          name: "create_banks",
          entrypoint: "create_banks",
        },
        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        },
      ],
    },
    [villagePassAddress]: {
      methods: [
        {
          name: "set_approval_for_all",
          entrypoint: "set_approval_for_all",
        },
      ],
    },
    [contractAddress(manifest, "config_systems")]: {
      methods: [
        {
          name: "set_agent_config",
          entrypoint: "set_agent_config",
        },
        {
          name: "set_world_config",
          entrypoint: "set_world_config",
        },
        {
          name: "set_mercenaries_name_config",
          entrypoint: "set_mercenaries_name_config",
        },
        {
          name: "set_biome_climate_config",
          entrypoint: "set_biome_climate_config",
        },
        {
          name: "set_season_config",
          entrypoint: "set_season_config",
        },
        {
          name: "set_vrf_config",
          entrypoint: "set_vrf_config",
        },
        {
          name: "set_starting_resources_config",
          entrypoint: "set_starting_resources_config",
        },
        {
          name: "set_map_config",
          entrypoint: "set_map_config",
        },
        {
          name: "set_capacity_config",
          entrypoint: "set_capacity_config",
        },
        {
          name: "set_resource_weight_config",
          entrypoint: "set_resource_weight_config",
        },
        {
          name: "set_tick_config",
          entrypoint: "set_tick_config",
        },
        {
          name: "set_resource_factory_config",
          entrypoint: "set_resource_factory_config",
        },
        {
          name: "set_donkey_speed_config",
          entrypoint: "set_donkey_speed_config",
        },
        {
          name: "set_battle_config",
          entrypoint: "set_battle_config",
        },
        {
          name: "set_hyperstructure_config",
          entrypoint: "set_hyperstructure_config",
        },
        {
          name: "set_bank_config",
          entrypoint: "set_bank_config",
        },
        {
          name: "set_troop_config",
          entrypoint: "set_troop_config",
        },
        {
          name: "set_building_config",
          entrypoint: "set_building_config",
        },
        {
          name: "set_building_category_config",
          entrypoint: "set_building_category_config",
        },
        {
          name: "set_resource_bridge_config",
          entrypoint: "set_resource_bridge_config",
        },
        {
          name: "set_resource_bridge_fee_split_config",
          entrypoint: "set_resource_bridge_fee_split_config",
        },
        {
          name: "set_resource_bridge_whitelist_config",
          entrypoint: "set_resource_bridge_whitelist_config",
        },
        {
          name: "set_structure_max_level_config",
          entrypoint: "set_structure_max_level_config",
        },
        {
          name: "set_structure_level_config",
          entrypoint: "set_structure_level_config",
        },
        {
          name: "set_settlement_config",
          entrypoint: "set_settlement_config",
        },
        {
          name: "set_trade_config",
          entrypoint: "set_trade_config",
        },
        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        },
      ],
    },
    [contractAddress(manifest, "dev_resource_systems")]: {
      methods: [
        {
          name: "mint",
          entrypoint: "mint",
        },
        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        },
      ],
    },
    [contractAddress(manifest, "guild_systems")]: {
      methods: [
        {
          name: "create_guild",
          entrypoint: "create_guild",
        },
        {
          name: "join_guild",
          entrypoint: "join_guild",
        },
        {
          name: "leave_guild",
          entrypoint: "leave_guild",
        },
        {
          name: "whitelist_player",
          entrypoint: "whitelist_player",
        },
        {
          name: "transfer_guild_ownership",
          entrypoint: "transfer_guild_ownership",
        },
        {
          name: "remove_guild_member",
          entrypoint: "remove_guild_member",
        },
        {
          name: "remove_player_from_whitelist",
          entrypoint: "remove_player_from_whitelist",
        },
        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        },
        {
          name: "update_whitelist",
          entrypoint: "update_whitelist",
        },
        {
          name: "remove_member",
          entrypoint: "remove_member",
        },
      ],
    },
    [contractAddress(manifest, "faith_systems")]: {
      methods: [
        {
          name: "pledge_faith",
          entrypoint: "pledge_faith",
        },
        {
          name: "remove_faith",
          entrypoint: "remove_faith",
        },
        {
          name: "update_wonder_ownership",
          entrypoint: "update_wonder_ownership",
        },
        {
          name: "update_structure_ownership",
          entrypoint: "update_structure_ownership",
        },
        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        },
      ],
    },
    [contractAddress(manifest, "hyperstructure_systems")]: {
      methods: [
        {
          name: "initialize",
          entrypoint: "initialize",
        },
        {
          name: "contribute",
          entrypoint: "contribute",
        },
        {
          name: "claim_share_points",
          entrypoint: "claim_share_points",
        },
        {
          name: "allocate_shares",
          entrypoint: "allocate_shares",
        },
        {
          name: "update_construction_access",
          entrypoint: "update_construction_access",
        },
        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        },
      ],
    },
    [contractAddress(manifest, "liquidity_systems")]: {
      methods: [
        {
          name: "add",
          entrypoint: "add",
        },
        {
          name: "remove",
          entrypoint: "remove",
        },
        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        },
      ],
    },
    [contractAddress(manifest, "name_systems")]: {
      methods: [
        {
          name: "set_address_name",
          entrypoint: "set_address_name",
        },
        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        },
      ],
    },
    [contractAddress(manifest, "ownership_systems")]: {
      methods: [
        {
          name: "transfer_structure_ownership",
          entrypoint: "transfer_structure_ownership",
        },
        {
          name: "transfer_agent_ownership",
          entrypoint: "transfer_agent_ownership",
        },
        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        },
      ],
    },
    [contractAddress(manifest, "production_systems")]: {
      methods: [
        {
          name: "create_building",
          entrypoint: "create_building",
        },
        {
          name: "destroy_building",
          entrypoint: "destroy_building",
        },
        {
          name: "pause_building_production",
          entrypoint: "pause_building_production",
        },
        {
          name: "resume_building_production",
          entrypoint: "resume_building_production",
        },
        {
          name: "burn_resource_for_labor_production",
          entrypoint: "burn_resource_for_labor_production",
        },
        {
          name: "burn_labor_for_resource_production",
          entrypoint: "burn_labor_for_resource_production",
        },
        {
          name: "burn_resource_for_resource_production",
          entrypoint: "burn_resource_for_resource_production",
        },
        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        },
      ],
    },
    [contractAddress(dojoConfig.manifest, "realm_systems")]: {
      methods: [
        {
          name: "create",
          entrypoint: "create",
        },
        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        },
      ],
    },
    [contractAddress(dojoConfig.manifest, "resource_bridge_systems")]: {
      methods: [
        {
          name: "deposit",
          entrypoint: "deposit",
        },
        {
          name: "withdraw",
          entrypoint: "withdraw",
        },
        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        },
      ],
    },
    [contractAddress(dojoConfig.manifest, "resource_systems")]: {
      methods: [
        {
          // Not an ERC-20 approve — resource transfer authorization
          // (game_id, caller_structure_id, recipient_structure_id, resources).
          // Cartridge warns on the name; adding spender/amount would encode an
          // ApprovalPolicy that fails to authorize the real call. Accepted
          // noise until an s3 ABI revision renames the entrypoint.
          name: "approve",
          entrypoint: "approve",
        },
        {
          name: "send",
          entrypoint: "send",
        },
        {
          name: "pickup",
          entrypoint: "pickup",
        },
        {
          name: "arrivals_offload",
          entrypoint: "arrivals_offload",
        },
        {
          name: "troop_troop_adjacent_transfer",
          entrypoint: "troop_troop_adjacent_transfer",
        },
        {
          name: "troop_structure_adjacent_transfer",
          entrypoint: "troop_structure_adjacent_transfer",
        },
        {
          name: "structure_troop_adjacent_transfer",
          entrypoint: "structure_troop_adjacent_transfer",
        },
        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        },
        {
          name: "structure_burn",
          entrypoint: "structure_burn",
        },
        {
          name: "troop_burn",
          entrypoint: "troop_burn",
        },
      ],
    },
    [contractAddress(dojoConfig.manifest, "relic_systems")]: {
      methods: [
        {
          name: "open_chest",
          entrypoint: "open_chest",
        },
        {
          name: "apply_relic",
          entrypoint: "apply_relic",
        },
        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        },
      ],
    },
    [contractAddress(dojoConfig.manifest, "artificer_systems")]: {
      methods: [
        {
          name: "burn_research_for_relic",
          entrypoint: "burn_research_for_relic",
        },
        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        },
      ],
    },
    [contractAddress(dojoConfig.manifest, "season_systems")]: {
      methods: [
        {
          name: "register_to_leaderboard",
          entrypoint: "register_to_leaderboard",
        },
        {
          name: "claim_leaderboard_rewards",
          entrypoint: "claim_leaderboard_rewards",
        },
        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        },
      ],
    },
    [contractAddress(dojoConfig.manifest, "structure_systems")]: {
      methods: [
        {
          name: "level_up",
          entrypoint: "level_up",
        },
        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        },
      ],
    },
    [contractAddress(dojoConfig.manifest, "swap_systems")]: {
      methods: [
        {
          name: "buy",
          entrypoint: "buy",
        },
        {
          name: "sell",
          entrypoint: "sell",
        },
        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        },
      ],
    },
    [contractAddress(dojoConfig.manifest, "trade_systems")]: {
      methods: [
        {
          name: "create_order",
          entrypoint: "create_order",
        },
        {
          name: "accept_order",
          entrypoint: "accept_order",
        },
        {
          name: "cancel_order",
          entrypoint: "cancel_order",
        },
        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        },
      ],
    },
    [contractAddress(dojoConfig.manifest, "troop_battle_systems")]: {
      methods: [
        {
          name: "attack_explorer_vs_explorer",
          entrypoint: "attack_explorer_vs_explorer",
        },
        {
          name: "attack_explorer_vs_guard",
          entrypoint: "attack_explorer_vs_guard",
        },
        {
          name: "attack_guard_vs_explorer",
          entrypoint: "attack_guard_vs_explorer",
        },
        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        },
      ],
    },
    [contractAddress(dojoConfig.manifest, "troop_management_systems")]: {
      methods: [
        {
          name: "guard_add",
          entrypoint: "guard_add",
        },
        {
          name: "guard_delete",
          entrypoint: "guard_delete",
        },
        {
          name: "explorer_create",
          entrypoint: "explorer_create",
        },
        {
          name: "explorer_add",
          entrypoint: "explorer_add",
        },
        {
          name: "explorer_delete",
          entrypoint: "explorer_delete",
        },
        {
          name: "explorer_explorer_swap",
          entrypoint: "explorer_explorer_swap",
        },
        {
          name: "explorer_guard_swap",
          entrypoint: "explorer_guard_swap",
        },
        {
          name: "guard_explorer_swap",
          entrypoint: "guard_explorer_swap",
        },
        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        },
      ],
    },
    [contractAddress(dojoConfig.manifest, "alt_movement_systems")]: {
      methods: [
        {
          name: "toggle_alternate",
          entrypoint: "toggle_alternate",
        },
        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        },
      ],
    },
    [contractAddress(dojoConfig.manifest, "troop_movement_systems")]: {
      methods: [
        {
          name: "explorer_move",
          entrypoint: "explorer_move",
        },
        {
          name: "explorer_extract_reward",
          entrypoint: "explorer_extract_reward",
        },

        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        },
      ],
    },
    [contractAddress(dojoConfig.manifest, "troop_movement_util_systems")]: {
      methods: [
        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        },
      ],
    },
    [contractAddress(dojoConfig.manifest, "troop_raid_systems")]: {
      methods: [
        {
          name: "raid_explorer_vs_guard",
          entrypoint: "raid_explorer_vs_guard",
        },
        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        },
      ],
    },
    [contractAddress(dojoConfig.manifest, "village_systems")]: {
      methods: [
        {
          name: "upgrade",
          entrypoint: "upgrade",
        },
        {
          name: "create",
          entrypoint: "create",
        },
        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        },
      ],
    },
    [env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS]: {
      methods: [
        {
          name: "VRF",
          description: "Verifiable Random Function",
          entrypoint: "request_random",
        },
      ],
    },
    [villagePassAddress]: {
      methods: [
        {
          name: "set_approval_for_all",
          entrypoint: "set_approval_for_all",
        },
      ],
    },
  };
  for (const key of Object.keys(contracts)) {
    let isZero = false;
    try {
      isZero = BigInt(key) === 0n;
    } catch {
      isZero = true;
    }
    if (!key || isZero) delete contracts[key];
  }
  return toSessionPolicies({
    contracts,
    messages: buildSigningMessages(chain),
  } as Parameters<typeof toSessionPolicies>[0]);
};
