import { ContractPolicies } from "@cartridge/controller";

export const policies: ContractPolicies = {
  "0x051fea4450da9d6aee758bdeba88b2f665bcbf549d2c61421aa724e9ac0ced8f": {
    methods: [
      {
        name: "VRF",
        description: "Verifiable Random Function",
        entrypoint: "request_random",
      },
    ],
  },
  "0x22fca458aa0869b4cacca2098ae8fe3cc462bc5cef9dd222a5a68055cb8906b": {
    methods: [
      {
        name: "dojo_name",
        entrypoint: "dojo_name",
      },
      {
        name: "change_owner_amm_fee",
        entrypoint: "change_owner_amm_fee",
      },
      {
        name: "change_owner_bridge_fee",
        entrypoint: "change_owner_bridge_fee",
      },
      {
        name: "world_dispatcher",
        entrypoint: "world_dispatcher",
      },
    ],
  },
  "0x158114da9a538d75512dc29b3d1995ff551dfb61bee80996232abe54b8febc2": {
    methods: [
      {
        name: "dojo_name",
        entrypoint: "dojo_name",
      },
      {
        name: "battle_pillage",
        entrypoint: "battle_pillage",
      },
      {
        name: "world_dispatcher",
        entrypoint: "world_dispatcher",
      },
    ],
  },
  "0x66bc2d8ef45ce10d3847cc901a41af6a05db34c0ea0ab87fc332ca8c9b2ccb0": {
    methods: [
      {
        name: "dojo_name",
        entrypoint: "dojo_name",
      },
      {
        name: "battle_start",
        entrypoint: "battle_start",
      },
      {
        name: "battle_force_start",
        entrypoint: "battle_force_start",
      },
      {
        name: "battle_join",
        entrypoint: "battle_join",
      },
      {
        name: "battle_leave",
        entrypoint: "battle_leave",
      },
      {
        name: "battle_claim",
        entrypoint: "battle_claim",
      },
      {
        name: "battle_resolve",
        entrypoint: "battle_resolve",
      },
      {
        name: "world_dispatcher",
        entrypoint: "world_dispatcher",
      },
    ],
  },
  "0x73dff02735d7031496afb34d28f6fd935d8f8e2db14b0877aaf871b3d11f524": {
    methods: [
      {
        name: "dojo_name",
        entrypoint: "dojo_name",
      },
      {
        name: "leave_battle",
        entrypoint: "leave_battle",
      },
      {
        name: "leave_battle_if_ended",
        entrypoint: "leave_battle_if_ended",
      },
      {
        name: "world_dispatcher",
        entrypoint: "world_dispatcher",
      },
    ],
  },
  "0x5ad0e42e034430f752a0c4e210c903df016ad10e349dbf63cc82988c99a571e": {
    methods: [
      {
        name: "dojo_name",
        entrypoint: "dojo_name",
      },
      {
        name: "create",
        entrypoint: "create",
      },
      {
        name: "pause_production",
        entrypoint: "pause_production",
      },
      {
        name: "resume_production",
        entrypoint: "resume_production",
      },
      {
        name: "destroy",
        entrypoint: "destroy",
      },
      {
        name: "world_dispatcher",
        entrypoint: "world_dispatcher",
      },
    ],
  },
  "0x5827e314ca954f7eb04127a2a321e5c1f8fa6d51546b8fa6d6b38830f2b6d18": {
    methods: [
      {
        name: "dojo_name",
        entrypoint: "dojo_name",
      },
      {
        name: "set_world_config",
        entrypoint: "set_world_config",
      },
      {
        name: "set_season_config",
        entrypoint: "set_season_config",
      },
      {
        name: "set_season_bridge_config",
        entrypoint: "set_season_bridge_config",
      },
      {
        name: "set_vrf_config",
        entrypoint: "set_vrf_config",
      },
      {
        name: "set_quest_config",
        entrypoint: "set_quest_config",
      },
      {
        name: "set_quest_reward_config",
        entrypoint: "set_quest_reward_config",
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
        name: "set_travel_stamina_cost_config",
        entrypoint: "set_travel_stamina_cost_config",
      },
      {
        name: "set_resource_weight_config",
        entrypoint: "set_resource_weight_config",
      },
      {
        name: "set_battle_config",
        entrypoint: "set_battle_config",
      },
      {
        name: "set_tick_config",
        entrypoint: "set_tick_config",
      },
      {
        name: "set_stamina_config",
        entrypoint: "set_stamina_config",
      },
      {
        name: "set_travel_food_cost_config",
        entrypoint: "set_travel_food_cost_config",
      },
      {
        name: "set_stamina_refill_config",
        entrypoint: "set_stamina_refill_config",
      },
      {
        name: "set_leveling_config",
        entrypoint: "set_leveling_config",
      },
      {
        name: "set_production_config",
        entrypoint: "set_production_config",
      },
      {
        name: "set_speed_config",
        entrypoint: "set_speed_config",
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
        name: "set_building_category_pop_config",
        entrypoint: "set_building_category_pop_config",
      },
      {
        name: "set_population_config",
        entrypoint: "set_population_config",
      },
      {
        name: "set_building_general_config",
        entrypoint: "set_building_general_config",
      },
      {
        name: "set_building_config",
        entrypoint: "set_building_config",
      },
      {
        name: "set_mercenaries_config",
        entrypoint: "set_mercenaries_config",
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
        name: "set_realm_max_level_config",
        entrypoint: "set_realm_max_level_config",
      },
      {
        name: "set_realm_level_config",
        entrypoint: "set_realm_level_config",
      },
      {
        name: "set_settlement_config",
        entrypoint: "set_settlement_config",
      },
      {
        name: "world_dispatcher",
        entrypoint: "world_dispatcher",
      },
    ],
  },
  "0x6c0ae788bf4a46b49a57a67944bfb614c8da00b2b99c5d2917ec9bafb8ed460": {
    methods: [
      {
        name: "dojo_name",
        entrypoint: "dojo_name",
      },
      {
        name: "create_admin_bank",
        entrypoint: "create_admin_bank",
      },
      {
        name: "world_dispatcher",
        entrypoint: "world_dispatcher",
      },
    ],
  },
  "0x56c668f4e561ec08a5e6b32064a42855f6ea8693806713f4f04ad2ca38353d2": {
    methods: [
      {
        name: "dojo_name",
        entrypoint: "dojo_name",
      },
      {
        name: "create",
        entrypoint: "create",
      },
      {
        name: "world_dispatcher",
        entrypoint: "world_dispatcher",
      },
    ],
  },
  "0x1c8793d542cb6fb3cb140279ece63cdb8265868874e2aed3dce8a7b7cffd256": {
    methods: [
      {
        name: "dojo_name",
        entrypoint: "dojo_name",
      },
      {
        name: "mint",
        entrypoint: "mint",
      },
      {
        name: "world_dispatcher",
        entrypoint: "world_dispatcher",
      },
    ],
  },
  "0x40236e6868cfc14d4a73b3ad4be0df18a7c88877a684be223c1a8593109d7d9": {
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
  "0x345779feb4e212431505dff8d8581c38de82201ad9cb6bc32d7bb547087f402": {
    methods: [
      {
        name: "dojo_name",
        entrypoint: "dojo_name",
      },
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
        name: "world_dispatcher",
        entrypoint: "world_dispatcher",
      },
    ],
  },
  "0xd4a3c274fbdc8ca6fc0c0a2e1bdb9f4ef78ec6efe253592e936bd2e5db712f": {
    methods: [
      {
        name: "dojo_name",
        entrypoint: "dojo_name",
      },
      {
        name: "get_points",
        entrypoint: "get_points",
      },
      {
        name: "create",
        entrypoint: "create",
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
        name: "world_dispatcher",
        entrypoint: "world_dispatcher",
      },
    ],
  },
  "0x12b32981130d1089c5642125fbe96cdb4da0562e904eb8da590a30ea4f0aa9d": {
    methods: [
      {
        name: "dojo_name",
        entrypoint: "dojo_name",
      },
      {
        name: "add",
        entrypoint: "add",
      },
      {
        name: "remove",
        entrypoint: "remove",
      },
      {
        name: "world_dispatcher",
        entrypoint: "world_dispatcher",
      },
    ],
  },
  "0x43b2a3f4e47fa52ef2549162f89258dbcbd23bc62a51d0a331b80039a66bc9b": {
    methods: [
      {
        name: "dojo_name",
        entrypoint: "dojo_name",
      },
      {
        name: "discover_shards_mine",
        entrypoint: "discover_shards_mine",
      },
      {
        name: "add_mercenaries_to_structure",
        entrypoint: "add_mercenaries_to_structure",
      },
      {
        name: "world_dispatcher",
        entrypoint: "world_dispatcher",
      },
    ],
  },
  "0x6e173c5aca48a948de710aea5492c1df18a3f477b666a9af82281e1024e7bd2": {
    methods: [
      {
        name: "dojo_name",
        entrypoint: "dojo_name",
      },
      {
        name: "explore",
        entrypoint: "explore",
      },
      {
        name: "world_dispatcher",
        entrypoint: "world_dispatcher",
      },
    ],
  },
  "0x7ad2d6a7a566fece8c3cb08b96ca16c43f6981c77f7e1b2fa2112aac2976661": {
    methods: [
      {
        name: "dojo_name",
        entrypoint: "dojo_name",
      },
      {
        name: "set_address_name",
        entrypoint: "set_address_name",
      },
      {
        name: "set_entity_name",
        entrypoint: "set_entity_name",
      },
      {
        name: "world_dispatcher",
        entrypoint: "world_dispatcher",
      },
    ],
  },
  "0x5f20dfb2ac256e7b8394d2ac6bbd12288c2844c64143a87e27cb5bd3027ebc0": {
    methods: [
      {
        name: "dojo_name",
        entrypoint: "dojo_name",
      },
      {
        name: "transfer_ownership",
        entrypoint: "transfer_ownership",
      },
      {
        name: "world_dispatcher",
        entrypoint: "world_dispatcher",
      },
    ],
  },
  "0x30b9c5bf6c05b8e950901079bba39766f4a4d23466f2df0258e1ecca3731e19": {
    methods: [
      {
        name: "dojo_name",
        entrypoint: "dojo_name",
      },
      {
        name: "create",
        entrypoint: "create",
      },
      {
        name: "upgrade_level",
        entrypoint: "upgrade_level",
      },
      {
        name: "quest_claim",
        entrypoint: "quest_claim",
      },
    ],
  },
  "0x1e859bd917c725f938d7ffecdd9f687e04af2b44cf534848895e7efa946378a": {
    methods: [
      {
        name: "dojo_name",
        entrypoint: "dojo_name",
      },
      {
        name: "deposit_initial",
        entrypoint: "deposit_initial",
      },
      {
        name: "deposit",
        entrypoint: "deposit",
      },
      {
        name: "start_withdraw",
        entrypoint: "start_withdraw",
      },
      {
        name: "finish_withdraw",
        entrypoint: "finish_withdraw",
      },
      {
        name: "world_dispatcher",
        entrypoint: "world_dispatcher",
      },
    ],
  },
  "0x7e9f737c5c89d0f4e2c2b9f0ffda396da22b2c9fa14106f2d940dddae35497a": {
    methods: [
      {
        name: "dojo_name",
        entrypoint: "dojo_name",
      },
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
        name: "world_dispatcher",
        entrypoint: "world_dispatcher",
      },
    ],
  },
  "0x6f2ca7adc33ebf6cbe7d539cb50dff53cffcc701ac252b65eadc9454e12e247": {
    methods: [
      {
        name: "dojo_name",
        entrypoint: "dojo_name",
      },
      {
        name: "register_to_leaderboard",
        entrypoint: "register_to_leaderboard",
      },
      {
        name: "claim_leaderboard_rewards",
        entrypoint: "claim_leaderboard_rewards",
      },
      {
        name: "world_dispatcher",
        entrypoint: "world_dispatcher",
      },
    ],
  },
  "0x67d9fbdbb222b30679aa4b6d4d15f0e16f984603996111c6ef8b425293d29c7": {
    methods: [
      {
        name: "dojo_name",
        entrypoint: "dojo_name",
      },
      {
        name: "buy",
        entrypoint: "buy",
      },
      {
        name: "sell",
        entrypoint: "sell",
      },
      {
        name: "world_dispatcher",
        entrypoint: "world_dispatcher",
      },
    ],
  },
  "0x4949075e31363f02ac3d4374bf1cb726873cd55a3f572dc85ddc9f8ef89c351": {
    methods: [
      {
        name: "dojo_name",
        entrypoint: "dojo_name",
      },
      {
        name: "create_order",
        entrypoint: "create_order",
      },
      {
        name: "accept_order",
        entrypoint: "accept_order",
      },
      {
        name: "accept_partial_order",
        entrypoint: "accept_partial_order",
      },
      {
        name: "cancel_order",
        entrypoint: "cancel_order",
      },
      {
        name: "world_dispatcher",
        entrypoint: "world_dispatcher",
      },
    ],
  },
  "0x5bb3ed403abb2ceeb6ce8911052a4f9c922f2d4777427454fcbea605192ddc9": {
    methods: [
      {
        name: "dojo_name",
        entrypoint: "dojo_name",
      },
      {
        name: "travel_hex",
        entrypoint: "travel_hex",
      },
      {
        name: "world_dispatcher",
        entrypoint: "world_dispatcher",
      },
    ],
  },
  "0x4d6d43ec3fe5fb0d22398f9aee1846285e7c44bfa3900b7e490d18a9fb4eae4": {
    methods: [
      {
        name: "dojo_name",
        entrypoint: "dojo_name",
      },
      {
        name: "army_create",
        entrypoint: "army_create",
      },
      {
        name: "army_delete",
        entrypoint: "army_delete",
      },
      {
        name: "army_buy_troops",
        entrypoint: "army_buy_troops",
      },
      {
        name: "army_merge_troops",
        entrypoint: "army_merge_troops",
      },
      {
        name: "world_dispatcher",
        entrypoint: "world_dispatcher",
      },
    ],
  },
  "0x47773b52867c0867b40b26408e3ff84fca0b1a9afe55c0cb0fe284c1a18c3d8": {
    methods: [
      {
        name: "dojo_name",
        entrypoint: "dojo_name",
      },
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
        name: "make_production_labor",
        entrypoint: "make_production_labor",
      },
      {
        name: "burn_production_labor",
        entrypoint: "burn_production_labor",
      },
      {
        name: "world_dispatcher",
        entrypoint: "world_dispatcher",
      },
    ],
  },
};
