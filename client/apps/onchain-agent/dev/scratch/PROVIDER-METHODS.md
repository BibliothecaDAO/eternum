# EternumProvider Methods

All public async methods on `EternumProvider` from `@bibliothecadao/provider`.

Legend:

- **CORE** = shared core function in `src/tools/core/` (available to MCP, PI agent, and CLI)
- **AUTO** = used by automation loop (`src/automation/`)
- **—** = not implemented as a tool

## Troop Management

| Method                   | Status | Description                                                         |
| ------------------------ | ------ | ------------------------------------------------------------------- |
| `explorer_create`        | CORE   | Spawn new army from a structure                                     |
| `explorer_add`           | CORE   | Reinforce existing army with more troops (must be adjacent to home) |
| `explorer_delete`        | —      | Disband an army, return troops to structure                         |
| `guard_add`              | CORE   | Add troops from storage to a structure's guard slot                 |
| `guard_delete`           | —      | Remove troops from a guard slot                                     |
| `explorer_explorer_swap` | CORE   | Transfer troops between two adjacent armies (same type/tier)        |
| `explorer_guard_swap`    | CORE   | Move troops from army to structure guard slot                       |
| `guard_explorer_swap`    | CORE   | Move troops from guard slot to adjacent army                        |

## Movement

| Method             | Status | Description                                     |
| ------------------ | ------ | ----------------------------------------------- |
| `explorer_travel`  | CORE   | Move army through explored tiles                |
| `explorer_explore` | CORE   | Move army into unexplored tile (with VRF)       |
| `explorer_move`    | —      | Combined move (travel or explore based on flag) |

## Combat

| Method                        | Status | Description                                        |
| ----------------------------- | ------ | -------------------------------------------------- |
| `attack_explorer_vs_explorer` | CORE   | Army attacks another army                          |
| `attack_explorer_vs_guard`    | CORE   | Army attacks a structure's guards                  |
| `attack_guard_vs_explorer`    | CORE   | Structure guard attacks adjacent army              |
| `raid_explorer_vs_guard`      | CORE   | Raid a structure (10% damage, can steal resources) |

## Resource Transfer

| Method                              | Status | Description                                                                                        | Blitz?               |
| ----------------------------------- | ------ | -------------------------------------------------------------------------------------------------- | -------------------- |
| `troop_troop_adjacent_transfer`     | CORE   | Transfer resources between adjacent armies                                                         | Yes                  |
| `troop_structure_adjacent_transfer` | CORE   | Transfer resources from army to adjacent structure                                                 | Yes                  |
| `structure_troop_adjacent_transfer` | —      | Transfer resources from structure to adjacent army                                                 | **BLOCKED in Blitz** |
| `send_resources`                    | CORE   | Send resources between structures (donkey caravan)                                                 | Yes                  |
| `send_resources_multiple`           | —      | Send resources to multiple structures                                                              | Yes                  |
| `pickup_resources`                  | CORE   | Pick up resources at a structure (used automatically by send_resources when sender has no donkeys) | Yes                  |
| `arrivals_offload`                  | AUTO   | Offload incoming resource arrivals                                                                 | Yes                  |
| `structure_burn`                    | —      | Destroy resources at a structure                                                                   | Yes                  |
| `troop_burn`                        | —      | Destroy resources carried by an army                                                               | Yes                  |

## Building & Production

| Method                                  | Status | Description                                                   |
| --------------------------------------- | ------ | ------------------------------------------------------------- |
| `create_building`                       | AUTO   | Construct a building on a realm                               |
| `destroy_building`                      | —      | Demolish a building                                           |
| `pause_production`                      | —      | Pause a building's production                                 |
| `resume_production`                     | —      | Resume a building's production                                |
| `execute_realm_production_plan`         | AUTO   | Run production (resource to resource + labor to resource)     |
| `burn_resource_for_labor_production`    | —      | Burn resources to produce labor                               |
| `burn_labor_for_resource_production`    | —      | Burn labor to produce resources                               |
| `burn_resource_for_resource_production` | —      | Burn resources to produce other resources                     |
| `upgrade_realm`                         | AUTO   | Upgrade realm level (Settlement to City to Kingdom to Empire) |
| `claim_wonder_production_bonus`         | —      | Claim production bonus from a wonder                          |

## Relics & Chests

| Method        | Status | Description                       |
| ------------- | ------ | --------------------------------- |
| `open_chest`  | CORE   | Open a relic chest (with VRF)     |
| `apply_relic` | CORE   | Apply a relic effect to an entity |

## Hyperstructures

| Method                       | Status | Description                                         |
| ---------------------------- | ------ | --------------------------------------------------- |
| `initialize`                 | —      | Initialize a hyperstructure                         |
| `contribute_to_construction` | —      | Contribute resources to hyperstructure construction |
| `set_access`                 | —      | Set hyperstructure construction access              |
| `allocate_shares`            | AUTO   | Allocate victory point shares to co-owners          |
| `claim_construction_points`  | —      | Claim construction contribution points              |
| `claim_share_points`         | AUTO   | Claim share points from hyperstructures             |

## Guilds

| Method                | Status | Description                |
| --------------------- | ------ | -------------------------- |
| `create_guild`        | —      | Create a new guild         |
| `join_guild`          | —      | Join an existing guild     |
| `leave_guild`         | —      | Leave current guild        |
| `update_whitelist`    | —      | Update guild whitelist     |
| `remove_guild_member` | —      | Remove a member from guild |
| `disband_guild`       | —      | Disband the guild          |

## Trading & Banking

| Method                       | Status | Description                     |
| ---------------------------- | ------ | ------------------------------- |
| `create_order`               | —      | Create a trade order            |
| `accept_order`               | —      | Accept a trade order            |
| `cancel_order`               | —      | Cancel a trade order            |
| `create_marketplace_orders`  | —      | Create marketplace orders       |
| `accept_marketplace_orders`  | —      | Accept marketplace orders       |
| `cancel_marketplace_order`   | —      | Cancel marketplace order        |
| `edit_marketplace_order`     | —      | Edit marketplace order          |
| `buy_resources`              | —      | Buy resources from bank AMM     |
| `sell_resources`             | —      | Sell resources to bank AMM      |
| `add_liquidity`              | —      | Add liquidity to bank pool      |
| `add_initial_bank_liquidity` | —      | Add initial bank liquidity      |
| `remove_liquidity`           | —      | Remove liquidity from bank pool |

## Realm Setup (Blitz)

| Method                                 | Status | Description                           |
| -------------------------------------- | ------ | ------------------------------------- |
| `blitz_realm_obtain_entry_token`       | —      | Get entry token for blitz game        |
| `blitz_realm_register`                 | —      | Register for blitz game               |
| `blitz_realm_make_hyperstructures`     | —      | Create hyperstructures in blitz       |
| `blitz_realm_assign_realm_positions`   | —      | Assign realm positions                |
| `blitz_realm_settle_realms`            | —      | Settle realms                         |
| `blitz_realm_assign_and_settle_realms` | —      | Assign positions + settle in one call |
| `create_village`                       | —      | Create a village structure            |
| `create_multiple_realms`               | —      | Create multiple realms at once        |
| `mint_starting_resources`              | —      | Mint starting resources for a realm   |

## Ownership

| Method                         | Status | Description                               |
| ------------------------------ | ------ | ----------------------------------------- |
| `transfer_structure_ownership` | —      | Transfer structure to another player      |
| `transfer_agent_ownership`     | —      | Transfer agent explorer to another player |

## Quests

| Method           | Status | Description          |
| ---------------- | ------ | -------------------- |
| `start_quest`    | —      | Start a quest        |
| `claim_reward`   | —      | Claim quest reward   |
| `disable_quests` | —      | Disable quest system |
| `enable_quests`  | —      | Enable quest system  |

## Season & Scoring

| Method                      | Status | Description               |
| --------------------------- | ------ | ------------------------- |
| `end_game`                  | —      | Close the season          |
| `season_prize_claim`        | —      | Claim leaderboard rewards |
| `blitz_prize_player_rank`   | —      | Get blitz player rank     |
| `blitz_prize_claim`         | —      | Claim blitz prize         |
| `commit_and_claim_game_mmr` | —      | Commit and claim game MMR |

## Config (Admin)

| Method                                  | Status | Description                           |
| --------------------------------------- | ------ | ------------------------------------- |
| `set_address_name`                      | —      | Set display name for address          |
| `set_entity_name`                       | —      | Set display name for entity           |
| `set_starting_resources_config`         | —      | Configure starting resources          |
| `set_map_config`                        | —      | Configure map parameters              |
| `set_season_config`                     | —      | Configure season settings             |
| `set_vrf_config`                        | —      | Configure VRF provider                |
| `set_resource_factory_config`           | —      | Configure resource production recipes |
| `set_bank_config`                       | —      | Configure bank parameters             |
| `set_troop_config`                      | —      | Configure troop damage/stamina        |
| `set_battle_config`                     | —      | Configure battle parameters           |
| `set_building_config`                   | —      | Configure building costs              |
| `set_building_category_config`          | —      | Configure building categories         |
| `set_hyperstructure_config`             | —      | Configure hyperstructure settings     |
| `set_structure_level_config`            | —      | Configure realm upgrade costs         |
| `set_structure_max_level_config`        | —      | Configure max structure levels        |
| `set_world_config`                      | —      | Configure world settings              |
| `set_capacity_config`                   | —      | Configure carrying capacity           |
| `set_donkey_speed_config`               | —      | Configure donkey speed                |
| `set_resource_weight_config`            | —      | Configure resource weights            |
| `set_trade_config`                      | —      | Configure trade settings              |
| `set_tick_config`                       | —      | Configure tick intervals              |
| `set_stamina_config`                    | —      | Configure stamina settings            |
| `set_stamina_refill_config`             | —      | Configure stamina regen               |
| `set_settlement_config`                 | —      | Configure settlement settings         |
| `set_agent_config`                      | —      | Configure AI agent settings           |
| `set_quest_config`                      | —      | Configure quest settings              |
| `set_mercenaries_name_config`           | —      | Configure mercenary names             |
| `set_resource_bridge_fees_config`       | —      | Configure bridge fees                 |
| `set_resource_bridge_whitlelist_config` | —      | Configure bridge whitelist            |
| `set_victory_points_config`             | —      | Configure victory points              |
| `set_game_mode_config`                  | —      | Configure blitz mode                  |
| `set_mmr_config`                        | —      | Configure MMR settings                |
| `set_travel_food_cost_config`           | —      | Configure travel food costs           |
| `set_blitz_registration_config`         | —      | Configure blitz registration          |

## Bridge

| Method                       | Status | Description                   |
| ---------------------------- | ------ | ----------------------------- |
| `bridge_withdraw_from_realm` | —      | Withdraw resources via bridge |
| `bridge_deposit_into_realm`  | —      | Deposit resources via bridge  |

## Test/Dev

| Method                                               | Status | Description                              |
| ---------------------------------------------------- | ------ | ---------------------------------------- |
| `mint_test_realm`                                    | —      | Mint a test realm token                  |
| `mint_season_passes`                                 | —      | Mint season passes                       |
| `mint_test_lords`                                    | —      | Mint test LORDS tokens                   |
| `attach_lords`                                       | —      | Attach LORDS to season pass              |
| `detach_lords`                                       | —      | Detach LORDS from season pass            |
| `mint_resources`                                     | —      | Mint resources (dev)                     |
| `mint_and_settle_test_realm`                         | —      | Mint + settle test realm                 |
| `create_banks`                                       | —      | Create admin banks                       |
| `change_bank_owner_fee`                              | —      | Change bank owner fee                    |
| `change_bank_bridge_fee`                             | —      | Change bank bridge fee                   |
| `set_factory_address`                                | —      | Set factory contract address             |
| `set_village_token_config`                           | —      | Configure village token                  |
| `set_quest_games`                                    | —      | Set quest game addresses                 |
| `grant_collectible_minter_role`                      | —      | Grant minter role                        |
| `set_discoverable_village_starting_resources_config` | —      | Configure discoverable village resources |
| `set_artificer_config`                               | —      | Configure artificer research cost        |
