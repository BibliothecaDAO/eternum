# A0 systems slice 2 — config, dev, faith, guild, hyperstructure, mmr, name, ownership, points, prize_distribution, production

## config_systems (config/contracts.cairo:281) — THE replay surface: 39 setters, all admin-gated via WorldConfig.admin_address (assert :319-327)

- set_world_config (:373) PERMISSIONLESS until admin set (first-caller-wins); derives map_center_offset from tx_hash
  (:387-391)
- set_season_config (:414): idempotent guard `if end_at == 0` — WRITE-ONCE: second game cannot set its own schedule
  (clock bug at contract level)
- set_blitz_registration_config (:920): DEPLOYS entry-token ERC721 via UDC (:954-958) — per-game side effect → registrar
- set_settlement_config (:894) reads blitz_exploration_config for base_distance (:902-905); set_blitz_exploration_config
  (:969) back-patches blitz_settlement_config.base_distance (:978-986) — TWO ordering dependencies
- set_mercenaries_name_config (:399): writes AddressName[0] — per-game value in global table
- uuid() setters (ResourceList/MinMaxList writers): set_starting_resources_config (:470,:489),
  set_resource_factory_config (:596,:608), set_building_category_config (:754,:772), set_structure_level_config (:866),
  set_village_found_resources_config (:1073)
- set_factory_address (:1021) → RETIRE
- dojo_init (:313) declares achievement trophies once — fine (player-global)
- Preset-row coverage: 33 WorldConfig members + 8 side tables (AgentConfig, AddressName[0], WeightConfig[rt],
  ResourceFactoryConfig[rt], HyperstrtConstructConfig[rt], BuildingCategoryConfig[cat], StructureLevelConfig[lvl],
  bridge whitelists) + ResourceList/ResourceMinMaxList uuid tables.
- Full setter list (39): agent, village_token, world, mercenaries_name, season, vrf, starting_resources, map,
  biome_climate, capacity, resource_weight, tick, resource_factory, donkey_speed, battle, hyperstructure, bank, troop,
  building, building_category, resource_bridge, bridge_fee_split, bridge_whitelist, structure_max_level,
  structure_level, settlement, blitz_registration, blitz_exploration, trade, quest, game_mode, factory_address, mmr,
  village_found_resources, victory_points_grant, victory_points_win, faith, bitcoin_mine, artificer.

## dev_resource_systems.mint (:23): admin-gated, no season gate; DERIVABLE but needs game guard — can mint into any game.

## faith_systems (:449): pledge_faith (:469) two entity ids no same-game assert (canonical adversarial case); claim_wonder_points (:713) writes WonderFaithWinners[WORLD_CONFIG_ID] global leaderboard + iterates winners array; blacklist (:759) NO season gate, blocked_id untyped felt (structure id OR address).

## faith_prize_systems: distribute_wonder_prizes (:234) PERMISSIONLESS NO PARAMS — pays balance_of(this) against global winners row; single-shot guard global → first game to end drains ALL games' faith pools. claim_player_prize (:276) same shared balance.

## guild_systems (:61): all MUST_PASS; gate = StructureOwnerStats(caller).structures_num > 0 (GLOBAL counter); one guild per address across all games; join in game B evicts from game A → flips GuildOnly hyperstructure access.

## hyperstructure_systems (:146): initialize (:187) coord TileOpt read+occupy (:245-250); contribute (:253) writes SeasonPrize[WORLD_CONFIG_ID] in loop (:322-327) + HyperstructureGlobals (:355-357) + PlayerRegisteredPoints[address] (:321); allocate_shares (:413) count_surrounding_realms scans 6 coords (utils/hyperstructure.cairo:162-202), writes PlayerRegisteredPoints for every listed address (:477-478); claim_share_points (:498) caller-supplied Span<ID> permissionless, nested loops (:507-590), SeasonPrize reads/writes (:505,:541,:581).

## mmr_systems (:35): commit_game_mmr_meta (:87) permissionless no auth no season gate; reads PlayersRankFinal[WORLD_CONFIG_ID] to find "the" trial; writes global MMR ERC20; MMRGameMeta/MMRClaimed keyed world_id but written with final_trial_id (:113,:169,:213,:217). claim_game_mmr (:187): mmr_token.update_mmr per player (:251); requires full player list one tx (:199-204). MMR stays global; trial selection must be game-scoped.

## name_systems.set_address_name (:17): global registry (keep); season gate commented out (:22-23); ALSO writes StructureOwnerStats.name (:37-38) — per-game stats model carries global name → supports split.

## ownership_systems: transfer_structure_ownership (:24) blitz mode OFF assert (:32-33) — disabled for Blitz; transfer_agent_ownership (:48) agent-controller global config.

## point_systems.view_registered_points (:20): PlayerRegisteredPoints keyed address only — leaderboard GLOBAL today; must become (game_id, address).

## prize_distribution_systems (:30):

- blitz_get_or_compute_series_chest_reward_state (:69): THE cross-game sync — factory call + dispatch into previous
  game's world (:98-106); writes SeriesChestRewardState + GameChestReward at WORLD_CONFIG_ID (:124,:131-139). →
  registrar-owned series row.
- blitz_prize_claim_no_game (:146): PAYOUT; fixed SYSTEM_TRIAL_ID=1000 (:62) collides across games; writes
  PlayersRankFinal (:185).
- blitz_prize_claim (:232): ERC20 payouts + lootchest mint (:291,:308) + elite NFT mint (:324) sized by GLOBAL point
  totals (PlayerRegisteredPoints :287, SeasonPrize :256, GameChestReward :263).
- blitz_prize_player_rank (:351): permissionless; caller-chosen trial_id; fee split from balance_of(this) = POOLED entry
  fees of all games (:413); PlayersRankFinal "already finalized" global guard (:372-373) blocks every other game;
  WorldRecord fee-split singleton write (:438); ranks by global points (:462-524); completion vs global SeasonPrize
  (:530-531).
- blitz_get_ranked (:576) / blitz_get_winner (:593): read PlayersRankFinal singleton — one winner for all games.

## production*systems (:42): create_building (:62) Building keyed (outer_col,outer_row,inner_col,inner_row) ABSOLUTE coords — cross-game row sharing; destroy/pause/resume same; burn*\* fns DERIVABLE with ResourceFactoryConfig reads.

Riskiest ranked: distribute_wonder_prizes; blitz_prize_player_rank; blitz_prize_claim; hyperstructure
contribute/claim_share_points; mmr commit/claim; series chest state sync; pledge_faith; building/hyperstructure coord
ops; guild create/join; set_season_config+set_blitz_registration_config write-once/deploy singletons; dev mint.
