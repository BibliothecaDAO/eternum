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
  "0x52af4d4b243462e91f68309722dc42f9f970cdce2c80a4f0240b60c3f8dab44": {
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
  "0x267b8cc82862b1451652a1606629bcf3ad200973f0ca096493b4693f697c80e": {
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
  "0x1fd0b5233b521873898e99517a70f96a5023840692d189476c2550055fb8086": {
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
  "0x477996a3e273e590b2a8bdbca65cc9f84be437872933e11dac1ef5090f7d32d": {
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
  "0x62392a4777dde7362055349c5a2cafc49a1488a4a2bc634e2dbef55807fa2a0": {
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
        name: "set_weight_config",
        entrypoint: "set_weight_config",
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
  "0x730dc36e3ac2726d2373ae50965dd4ba793ab3bbfc4d51d73d5a8108cb80175": {
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
  "0x789a850d97d714ca0d2ebef8d61c25cd2342fc310fa10bb3b6c2edad1172351": {
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
  "0x3920dbf33145cca955528fee24474def2f7e48b0071c04cd31572216e5abdce": {
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
  "0x67dfe2d094f457fc478568d433efcbbad8ed98f35351199f1aae72424727713": {
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
  "0x2cf9b074003aeae091861585eade1d1007641c95978cbc67170a6a7002c6117": {
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
  "0x1fd92361d6679473f165797c5285e1c346dc84246798f7e9459bb337531e56f": {
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
  "0xe63ce3d808072f67ac366cff1e44ff148eaf4ddd1e836b98a1ba44af66faa3": {
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
  "0x3e6ad1a5ca5dd74c4abfced52e6649cd7e99763f8aaa695175043cfa5aad8f7": {
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
  "0x368661fcdc42f68583bc09db6642918704fcea2a3c432bfdb508f7194537910": {
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
  "0x395bd73f4abb836bb7eb6dc7f0f761be93596a6d892a118d2b82f77c54618b4": {
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
  "0x1e21e76506aff91e258bbe8cb8c80393faa1dcb72569b4a9ba72eb10c2c01b7": {
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
  "0x3d266b405275aeb27660eeaa4e8d5c3e24f8c3075da67276e0300da1df66c33": {
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
  "0x14f385db5b18cd094d9b4961f4d2a4a170e305385e2a3d9c5a1bd7cd499928b": {
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
  "0x5422c3c15cff91dedd781d6a24228dc7bdd65a0a9130e77375085c4fe6f06d4": {
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
  "0x675662c85d93e590ab147f5af80eb359b3a6cc388f44578b7aebdc2e735b43": {
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
  "0xef2b5150890396d22c3183a69b22b747ccac4429b5415ec35d9dab635a65b8": {
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
  "0xc592377a9b924df5d609994a7561dd989254b736d22085c9c78e6979a2969e": {
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
};
