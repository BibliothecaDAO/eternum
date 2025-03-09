import { toSessionPolicies } from "@cartridge/controller";

export const policies = toSessionPolicies({
  contracts: {
    "0x051fea4450da9d6aee758bdeba88b2f665bcbf549d2c61421aa724e9ac0ced8f": {
      methods: [
        {
          name: "VRF",
          description: "Verifiable Random Function",
          entrypoint: "request_random",
        },
      ],
    },
    "0x561b10faf4a0809ea306e266bb3c3c91022af032575483fcc633ed6b9d0c9ac": {
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
    "0x4da090eae1bd76c455948aa43755ce1a322c4c717abb98ffd2992fd4d9fe5fe": {
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
    "0x29c169487fb01d1692f7d7eb3f8e1e0cb84956b4d202483c1673baeec878f49": {
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
    "0x32762adec37d1e60a05fcba2637ec7549f3c53ebf049fcb5d210cab0e1e5049": {
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
    "0x11a287955d3d3ed0ecb09cd2efa7cff790a4fc51855a9686e7a6550c0b77759": {
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
          name: "set_production_config",
          entrypoint: "set_production_config",
        },
        {
          name: "set_donkey_speed_config",
          entrypoint: "set_donkey_speed_config",
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
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        },
      ],
    },
    "0x502c164cb455df87523c1dedd1bca31f84d2e606ddc65bcb269a498aa359ed": {
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
    "0x7359e457467997d408b6076b937cb7113d62c59228979dad1b438c4612e609b": {
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
    "0x70371c660e5f3ec3e5be9145c9ce2617d4de847a47b7af2d6125c52242af8d3": {
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
    "0x56a46bc9102292c4d9f6bde68f9456d077f55a3510e7cceca85a7bb1534bf45": {
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
    "0x1787fe6ce363eb00e36978a7cbf21cd1f4c96cdd8d88ca8fcc762d79127568": {
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
    "0x6f29997ad3fec03fa79e043d69260b39baf0690cc5198bdec510ba0d9d200af": {
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
    "0x79300036c247389c377da6b3f01106509aa35c75e16a290d385ceec66857f98": {
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
    "0x4689dfaef6f420319ce563d34fb1dd9b6977de2df92b1c0a017bc3d8655bc94": {
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
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        },
      ],
    },
    "0x6a6f3c146615de99d4a8ee3e0ee1502273f9afa77cfb1c043d48da00273031b": {
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
    "0x13f688b9e847a188d6e3306c57ad4cedc846207ec0d4214d3adb966f89abda6": {
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
    "0x191873803184fc4e0451b81dfe2669da6f0cf58c88dea309f1fa9a4619f5eb6": {
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
    "0x723ba0c92e633c8a6102f712622e150929a3648473b3f41fc3d44980ff52a2c": {
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
    "0x3f9d839acf395f17f8981a294086039a7da36ac4379a3948d8d99ce53ea4c8b": {
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
    "0x3492ee537f3e7764c154bb0925138c5e42686e765aadfdfdf6e05317fdeb0e8": {
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
    "0x2879f978463222b47af7334efec7c7b23da6c7fdba76386710fcca3f8a6d95a": {
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
    "0x7d2fb638516c4a32858ef7bf09865389edc60c3cb9e6d4d0049c0ad7a214c6a": {
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
    "0x133660106d03c9811a9ce63fe2464e99f0816b83439c55003ebdde53f560655": {
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
    "0x78c5142660121a5d0fba6e82a10f0530c7b824d69aa0075165320acc76cb9c6": {
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
          name: "burn_labor_resources_for_other_production",
          entrypoint: "burn_labor_resources_for_other_production",
        },
        {
          name: "burn_other_predefined_resources_for_resources",
          entrypoint: "burn_other_predefined_resources_for_resources",
        },
        {
          name: "burn_other_resources_for_labor_production",
          entrypoint: "burn_other_resources_for_labor_production",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        },
      ],
    },
  },
});
