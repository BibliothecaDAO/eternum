import { toSessionPolicies } from "@cartridge/controller";
import { messages } from "./signing-policy";

export const policies = toSessionPolicies({
  contracts: {
    "0x4c36a33d1804f02549d321f22c30fbba7d20e78a535f6c826340f94a28df8fd": {
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
    "0x630be9829efbbdb0c47bf947cef6f8594e224def5a1a4e7e89642d2b7079b47": {
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
    "0x6b2e4392a69eeee3f27334cab7ddb1418e4d53efb56563889aad6f1fcc89294": {
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
    "0x58fd0056317eb25fa5811555ce33454e73f54ce7be13040d0fef7fabdeafbbf": {
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
        }
      ],
    },
    "0x87e27e30eba9aab561fcdadec66ca823e502bd6dee6a476290c5d05fb6df6": {
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
        }
      ],
    },
    "0x395aac9e2b67265ee689fa886614b1b99d18ca088fa7d13b69eaa2ead368b44": {
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
    "0x1f56b00f72414ace1973d215046ff63bcd54fd5781b7063ca4e0596aaf1465b": {
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
    "0x651230ee8be340eca86392f4f61398b5bbc23ae49122a60c79f63433d6611db": {
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
    "0x52f1e9a4f562e0c69432357c285914218e1a05100f9693b60be983288494489": {
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
    "0x4db08b5adba7175a1ab73f904ea36e2ad8fbfe24cecabce97ff001bda126ed1": {
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
    "0x1c837febf99e6c053f3aacdd6cc94f62a2fd86752c08fce4f8ff704476c4ffd": {
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
    "0x29cd606f0cdd6b264da8c84d20560cc53a9fe1fd9184f6f963ac47ab6abeab3": {
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
        }
      ],
    },
    "0x5f3e089c5367695ed89afb3b54547c780ddc351cf0cf551de90ea9905d33c60": {
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
        }
      ],
    },
    "0x34f42aa74819d39874bcc40460f0cc3f6040179756e28591401b9a493cb4114": {
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
    "0x73c51c86e7e338522fc80a843912e9f7b96be949911be956d2cb373c99045e3": {
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
    "0x1eaa8ae2020ab99a382ad36c3e73938e2c5f64965fdb07fa0c8ec7f64a743ab": {
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
    "0x1ab053833cf6e3cf1b26ad72d8560a87477e6a2d3f4cd630d6e51b4dfabc6a8": {
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
    "0x30c4c9dc171ec7867f3bbcf5390b43c20d1c40224f14e4b141678afc73f6314": {
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
    "0x43c049c70530e5c033282c85c530dc024e9d721a983d90fd95b216d37bee32f": {
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
    "0x25bf93ca0e6b34593aa8e7889148fd2afc619d8a09f275f7e3c478f3dc1fb60": {
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
    "0x4ad58ce3550a07306dd564c06df260f0b80a92080496fc133c9d4b3d4a36df9": {
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
    "0x5c2ab0e88b9e2f8b502973f36bbb4f8de589a166ce1071f37fcd0dac6c03f5b": {
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
    "0x4783183eda5de5c2cdfcdbfc736568c12b47a5cba240b20fe1da40ad60a21fe": {
      methods: [
      ],
    }
  },
  messages,
});
