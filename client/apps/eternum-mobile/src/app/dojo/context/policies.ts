import { toSessionPolicies } from "@cartridge/controller";
import { messages } from "./signing-policy";

export const policies = toSessionPolicies({
  contracts: {
    "0x18b9148a166e58cd719ac89996f48a7f9e5e050824ba3922a1c857634deaded": {
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
    "0x10da13d48ab6a2408139ef53b09b2b7a19292b20ecd487f748001842ed18946": {
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
    "0x1e5201004ca12f8b131799f26ae9c9c17f6d1602907e1e3d6788ea0cd69392f": {
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
    "0x358239acadbe0d46e12b0fc13345afd14a7e271e0e752a4fc8bb9caf6a1a652": {
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
      ],
    },
    "0xef8353b356d25a369c5399cb89029f53f7cdd19dea612470a6effa1f5d8d4e": {
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
    "0x3b18caf2845394357555ba0f413b4f9c1b0aeb401b35c357636c3e1dd6ab07a": {
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
    "0x6ca7d5fc383284bf679d0156728cabbd57b8a467671eaeff46a7beabf0437f4": {
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
    "0x3a1738d17af9b541ce064eb390e554ae50c28013cdae10bcbbc9908f340f462": {
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
    "0x4ed8e64f23ee7bba99cf6fd750b6b61ec8b7a8a4cc7ffb9ffd737e85dd98d0": {
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
    "0x6961d3f47a78a1228dbaf25b36651ae158a18f34db8d399ca87cb35a02097b7": {
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
    "0x5d0b815e8824b2298425264d7302749a25b244c0709cbc5dac48d2711e2054c": {
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
    "0x32263b5ee54112732e960f70551f0d364bfc6285d79f1c4f5e098875e73717e": {
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
    "0x45f8cd7b9b8bd8eddad5ebd73f0ab88cfdf094c520df4ba7e669bfc997c8be4": {
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
    "0x6a7d39a0f0713ff621acc63560210d11c13426a034e16fca23323c880edb2f4": {
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
    "0x8be7b8a995419b755ed4c6a9a9d35133d8b34e1b1b25f5067a9701f345ef6": {
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
    "0x5169dc50402f24ef420ffc855364781fb1c644635e46713e6fa6e3c7a907b60": {
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
    "0x35d52751cb2568efc010c28c32bc188103d5dea638324fe1130d27e9997b0c4": {
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
    "0x118088b602a81601d5e21b944e5574f9b7903789d20d075fdaffa47fd2d80e0": {
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
    "0x779ba8d0430782b834f97372b64a26f6241a1e5ea5a4fc392fd9e0f1caf7f7f": {
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
    "0x6d8a6e3287121f742c445761c74f652c69f23826cfdb76483ad44b205e7904": {
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
    "0x29e5629077fef197a91b956648eea23714466dcbcd23b993a531285e36cf8dd": {
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
    "0x6c15f9c3ab41aa8992d1159b24efdf95c8432f001930461f7a4d61e3cd311ea": {
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
    "0x4c36a33d1804f02549d321f22c30fbba7d20e78a535f6c826340f94a28df8fd": {
      methods: [],
    },
  },
  messages,
});
