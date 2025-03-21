import { toSessionPolicies } from "@cartridge/controller";
import { messages } from "./signing-policy";

export const policies = toSessionPolicies({
  contracts: {
    "0x4783183eda5de5c2cdfcdbfc736568c12b47a5cba240b20fe1da40ad60a21fe": {
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
    "0x64e032240fdb351a6e710cebd035f0349dbd92a757a1da3a204d338fb530483": {
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
          name: "set_production_config",
          entrypoint: "set_production_config",
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
    "0x6123d377c7ab9526d134037bc8c634f128e29fb74fef50717b99ab9549baf91": {
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
    "0x33ffbee07def424b88bc093baad07bb735b8268e40da8f6d4d5bac51b080ac4": {
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
    "0x37d811a5263c21e35ae9300cb054f7d306d507965eaa50698f961ecf455f80d": {
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
    "0x6310027e3936b75fbf5794d13e520034bfb6f2d5027d0fa11c406ef9d2b48d4": {
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
    "0x1a0a159602b469315344befbc6dd4f2b0886eb4729c504b79fa37707c0ff439": {
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
    "0x78bd477906360716bf977bc9770120d11da5c33b098e6deea84342a27af27ce": {
      methods: [
        {
          name: "transfer_ownership",
          entrypoint: "transfer_ownership",
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
    "0x560bc99937e0d22f469d2fe86b47c50d77da29aa5b61ac645df0c06d72e3462": {
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
          name: "burn_other_resources_for_labor_production",
          entrypoint: "burn_other_resources_for_labor_production",
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
          name: "dojo_name",
          entrypoint: "dojo_name",
        },
        {
          name: "world_dispatcher",
          entrypoint: "world_dispatcher",
        }
      ],
    },
    "0x7a963a4c91ccc6f4ee6ac387d0101e822befc3a790638c32c4469addece25a9": {
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
    "0x6102c9a3cc0b841aa515af052acb2c5ba30f20acca343707df6ef84f39b0580": {
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
    "0x39dd54255f6bc407b0cb989c02bbc817960e89441c267ff2c1501c04e9290d1": {
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
    "0x4e207ec2a2383320236841da7799bedb86f9690103ddf7133178370d83eff30": {
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
    "0x15bda33baec77a6cf75df5220efa932b5bbf4ba13133fc4411111c6b090112f": {
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
    "0x21b97bd2af72c47fd383eb70d09126cf0c26758e0190a7aa445e5e346b18ede": {
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
    "0x28e5c99db5cb6e55f31ca039f8b715196d47f0dde42f64651074596c1f21499": {
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
    "0x3b1b4d266b3e7661a5604746a996307c21b3968c80df9d84ae9ce65b018ca12": {
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
    "0x5d401ac7537dd4d6ab7fc8d14dc1c0201bbb5235344895c6b34f99b7ec14475": {
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
    "0x780bf2932868233307aa83c981d1f6c18ca5a70b93d39d344e17b7ee6c4684e": {
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
    "0x6929ab51427f510e630d78c0764751ecc23686bc2ace0b0a7e17c596f8d453b": {
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
    "0x769ded3b01fe727d441694cbb64f6e428ea03a5dc4a0d9e871d5d5ac5df5c71": {
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
    "0xcfb18212478b8938e327b106dba3180d879047dcb6a4fbf4bfde1c92aa3834": {
      methods: [
      ],
    }
  },
  messages,
});
