import { toSessionPolicies } from "@cartridge/controller";
import { messages } from "./signing-policy";

export const policies = toSessionPolicies({
  contracts: {
    "0x316ee6dbedcd64557f238bd1abd7a50abfa73238fe952eb80cf43aeb47eb421": {
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
        }
      ],
    },
    "0x3419f59721edd77282f8c105bb91a114ba5391e6bc43394edf6d15be557ae9d": {
      methods: [
        {
          name: "set_agent_controller",
          entrypoint: "set_agent_controller",
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
        }
      ],
    },
    "0x58865c4d8dd2cb7909f8f16cef0bbe6203f8510df921a18d9661e3745b09594": {
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
        }
      ],
    },
    "0x68346816631f9d32ff8802bb585425735226a3b1c25ac4b6a3768f02f3d90b": {
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
          name: "update_whitelist",
          entrypoint: "update_whitelist",
        },
        {
          name: "remove_member",
          entrypoint: "remove_member",
        },
        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        }
      ],
    },
    "0x6a1d60ad22d9bf1a40489514c4e65fb8511844552f04c6bff365602c6112ee2": {
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
          name: "allocate_shares",
          entrypoint: "allocate_shares",
        },
        {
          name: "update_construction_access",
          entrypoint: "update_construction_access",
        },
        {
          name: "claim_construction_points",
          entrypoint: "claim_construction_points",
        },
        {
          name: "claim_share_points",
          entrypoint: "claim_share_points",
        },
        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        }
      ],
    },
    "0x36fb50f935f6b8d879d24d2e77f009dc91827a6447ed9654ec27f4b0c8764a4": {
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
        }
      ],
    },
    "0x3452b82c4d257d7b64074683a86b7d2aae32e2b5073b5828a990e05ae4bfbd0": {
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
        }
      ],
    },
    "0x75e5d443305d119727875b4f8f571f59feb319c757fe7b109948e143cb79c41": {
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
        }
      ],
    },
    "0x741eff0b330bc187b66b187f048e97cf958b2e10d33e810aaba8ec49f261e02": {
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
        }
      ],
    },
    "0x747dcaf8e72c5a7410f07bed79baa94278391a17d39a07671f7f73eb7aa6d93": {
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
        }
      ],
    },
    "0x71cc023a6afd873d78128f412fdee1c0d35f94a8c157ffe9208cafb81fc524": {
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
        }
      ],
    },
    "0x4e2fb260a8b6ced4906a686eeb68f3df4d89782532079385ebbe5012ca2c81e": {
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
          name: "troop_burn",
          entrypoint: "troop_burn",
        },
        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        }
      ],
    },
    "0x758288d0ebc951b1001b59e2676a77066e4a50a1060b32ee5897e82e28feeb7": {
      methods: [
        {
          name: "season_close",
          entrypoint: "season_close",
        },
        {
          name: "season_prize_claim",
          entrypoint: "season_prize_claim",
        },
        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        }
      ],
    },
    "0xe287466d119ec57229d9dbce90f50f47ffd4c567b21a5bbda304327fb42e2b": {
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
        }
      ],
    },
    "0x7e2cc4197717203270bbaef92398ad7eb08431623bcde361b858a1df0670b36": {
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
        }
      ],
    },
    "0x7eb5b7aeed25c0a8c85c6d5cc690bdfb15d5217ddabb6e254ea4285cfaafb0d": {
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
        }
      ],
    },
    "0x3ceb7da8fd0730daa0907de35a1da849ce58e03d206f4f2e99805ef7417d44a": {
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
        }
      ],
    },
    "0x4806eba832ac5892375637230434551814b0a766472f33ec8877bf66ab61687": {
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
        }
      ],
    },
    "0x5ec99caf935a883df339f750fa17dff9f0d8a99ef860cf6d17f5f3c24356468": {
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
        }
      ],
    },
    "0x4de7ab05642f8fc9aca0abf4284dbb08ae074a932fcc2c2eaf0956e6f1d1dba": {
      methods: [
        {
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        }
      ],
    },
    "0x148f0719d6d26f93ce7f88212bf064287642aa3b79296f003b7917bbc59ab8f": {
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
        }
      ],
    },
    "0x1f0f5bde13f6a96bd977cdccc81f5a0e11c84c5d515b7a0fde965a60aefadc0": {
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
        }
      ],
    },
    "0x051fea4450da9d6aee758bdeba88b2f665bcbf549d2c61421aa724e9ac0ced8f": {
      methods: [
        {
          name: "VRF",
          description: "Verifiable Random Function",
          entrypoint: "request_random",
        }
      ],
    },
    "0x18b9148a166e58cd719ac89996f48a7f9e5e050824ba3922a1c857634deaded": {
      methods: [
      ],
    }
  },
  messages,
});
