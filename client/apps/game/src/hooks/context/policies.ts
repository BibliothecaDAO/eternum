import { getSeasonPassAddress, getVillagePassAddress } from "@/utils/addresses";
import { toSessionPolicies } from "@cartridge/controller";
import { getContractByName } from "@dojoengine/core";
import { dojoConfig } from "../../../dojoConfig";
import { messages } from "./signing-policy";

export const policies = toSessionPolicies({
  contracts: {
    [getContractByName(dojoConfig.manifest, "s1_eternum", "bank_systems").address]: {
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
    [getContractByName(dojoConfig.manifest, "s1_eternum", "config_systems").address]: {
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
    [getContractByName(dojoConfig.manifest, "s1_eternum", "dev_resource_systems").address]: {
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
    [getContractByName(dojoConfig.manifest, "s1_eternum", "guild_systems").address]: {
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
    [getContractByName(dojoConfig.manifest, "s1_eternum", "hyperstructure_systems").address]: {
      methods: [
        {
          name: "initialize",
          entrypoint: "initialize",
        },
        {
          name: "contribute_to_construction",
          entrypoint: "contribute_to_construction",
        },
        {
          name: "set_co_owners",
          entrypoint: "set_co_owners",
        },
        {
          name: "end_game",
          entrypoint: "end_game",
        },
        {
          name: "set_access",
          entrypoint: "set_access",
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
    [getContractByName(dojoConfig.manifest, "s1_eternum", "liquidity_systems").address]: {
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
    [getContractByName(dojoConfig.manifest, "s1_eternum", "name_systems").address]: {
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
    [getContractByName(dojoConfig.manifest, "s1_eternum", "ownership_systems").address]: {
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
    [getContractByName(dojoConfig.manifest, "s1_eternum", "production_systems").address]: {
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
    [getContractByName(dojoConfig.manifest, "s1_eternum", "realm_systems").address]: {
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
    [getContractByName(dojoConfig.manifest, "s1_eternum", "resource_systems").address]: {
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
    [getContractByName(dojoConfig.manifest, "s1_eternum", "resource_systems").address]: {
      methods: [
        {
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
      ],
    },
    [getContractByName(dojoConfig.manifest, "s1_eternum", "season_systems").address]: {
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
    [getContractByName(dojoConfig.manifest, "s1_eternum", "structure_systems").address]: {
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
    [getContractByName(dojoConfig.manifest, "s1_eternum", "swap_systems").address]: {
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
    [getContractByName(dojoConfig.manifest, "s1_eternum", "trade_systems").address]: {
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
    [getContractByName(dojoConfig.manifest, "s1_eternum", "troop_battle_systems").address]: {
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
    [getContractByName(dojoConfig.manifest, "s1_eternum", "troop_management_systems").address]: {
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
    [getContractByName(dojoConfig.manifest, "s1_eternum", "troop_movement_systems").address]: {
      methods: [
        {
          name: "explorer_move",
          entrypoint: "explorer_move",
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
    [getContractByName(dojoConfig.manifest, "s1_eternum", "troop_movement_util_systems").address]: {
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
    [getContractByName(dojoConfig.manifest, "s1_eternum", "troop_raid_systems").address]: {
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
    [getContractByName(dojoConfig.manifest, "s1_eternum", "village_systems").address]: {
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
    "0x051fea4450da9d6aee758bdeba88b2f665bcbf549d2c61421aa724e9ac0ced8f": {
      methods: [
        {
          name: "VRF",
          description: "Verifiable Random Function",
          entrypoint: "request_random",
        },
      ],
    },
    [getSeasonPassAddress()]: {
      methods: [
        {
          name: "set_approval_for_all",
          entrypoint: "set_approval_for_all",
        },
      ],
    },
    [getVillagePassAddress()]: {
      methods: [
        {
          name: "set_approval_for_all",
          entrypoint: "set_approval_for_all",
        },
      ],
    },
  },
  messages,
});
