#[cfg(test)]
mod two_games {
    use dojo::model::{ModelStorage, ModelStorageTest};
    use dojo_snf_test::{NamespaceDef, TestResource, spawn_test_world};
    use starknet::ContractAddress;
    use crate::constants::DEFAULT_NS_STR;
    use crate::models::agent::{AgentConfig, AgentCount};
    use crate::models::config::BlitzSettlement;
    use crate::models::game::{GameRegistry, GameRegistryImpl, GameStatus};
    use crate::models::guild::{GuildMember, GuildWhitelist};
    use crate::models::hyperstructure::PlayerRegisteredPoints;
    use crate::models::map::{Tile, TileImpl};
    use crate::models::map2::TileOpt;
    use crate::models::position::Coord;
    use crate::models::rank::PlayerRank;
    use crate::models::resource::resource::ResourceAllowance;
    use crate::models::series_chest_reward::GameChestReward;
    use crate::models::structure::StructureOwnerStats;

    const GAME_A: u32 = 1;
    const GAME_B: u32 = 2;

    fn addr(value: felt252) -> ContractAddress {
        value.try_into().unwrap()
    }

    fn namespace_def() -> NamespaceDef {
        NamespaceDef {
            namespace: DEFAULT_NS_STR(),
            resources: [
                TestResource::Model("GameRegistry"), TestResource::Model("TileOpt"), TestResource::Model("AgentCount"),
                TestResource::Model("PlayerRank"), TestResource::Model("GuildMember"),
                TestResource::Model("GuildWhitelist"), TestResource::Model("StructureOwnerStats"),
                TestResource::Model("AgentConfig"), TestResource::Model("BlitzSettlement"),
                TestResource::Model("PlayerRegisteredPoints"), TestResource::Model("ResourceAllowance"),
                TestResource::Model("GameChestReward"),
            ]
                .span(),
        }
    }

    fn game(game_id: u32, seed: felt252) -> GameRegistry {
        GameRegistry {
            game_id,
            name: if game_id == GAME_A {
                'game_a'
            } else {
                'game_b'
            },
            series_id: 'series',
            game_number_in_series: game_id.try_into().unwrap(),
            preset_id: 1,
            creator: addr('creator'),
            status: GameStatus::Live,
            dev_mode_on: false,
            start_settling_at: 100,
            start_main_at: 200,
            end_at: if game_id == GAME_A {
                1000
            } else {
                1200
            },
            end_grace_seconds: 60,
            registration_grace_seconds: 60,
            final_trial_id: 0,
            seed,
        }
    }

    #[test]
    fn two_concurrent_games_keep_overlapping_state_isolated() {
        let mut world = spawn_test_world([namespace_def()].span());
        world.write_model_test(@game(GAME_A, 111));
        world.write_model_test(@game(GAME_B, 222));

        let player = addr('player');
        let guild = addr('guild');
        let coord = Coord { alt: false, x: 42, y: 42 };

        let mut tile_a = TileImpl::keys_only(GAME_A, coord);
        tile_a.biome = 3;
        let mut tile_b = TileImpl::keys_only(GAME_B, coord);
        tile_b.biome = 7;
        let tile_opt_a: TileOpt = tile_a.into();
        let tile_opt_b: TileOpt = tile_b.into();
        world.write_model_test(@tile_opt_a);
        world.write_model_test(@tile_opt_b);

        world.write_model_test(@AgentCount { game_id: GAME_A, count: 4 });
        world.write_model_test(@AgentCount { game_id: GAME_B, count: 9 });
        world
            .write_model_test(
                @AgentConfig {
                    game_id: GAME_A,
                    max_lifetime_count: 10,
                    max_current_count: 4,
                    min_spawn_lords_amount: 1,
                    max_spawn_lords_amount: 2,
                },
            );
        world
            .write_model_test(
                @AgentConfig {
                    game_id: GAME_B,
                    max_lifetime_count: 20,
                    max_current_count: 8,
                    min_spawn_lords_amount: 2,
                    max_spawn_lords_amount: 4,
                },
            );
        world.write_model_test(@BlitzSettlement { game_id: GAME_A, player, structure_ids: array![11].span() });
        world.write_model_test(@BlitzSettlement { game_id: GAME_B, player, structure_ids: array![22].span() });
        world
            .write_model_test(
                @ResourceAllowance {
                    game_id: GAME_A, owner_entity_id: 1, approved_entity_id: 2, resource_type: 3, amount: 50,
                },
            );
        world
            .write_model_test(
                @ResourceAllowance {
                    game_id: GAME_B, owner_entity_id: 1, approved_entity_id: 2, resource_type: 3, amount: 75,
                },
            );
        world.write_model_test(@PlayerRegisteredPoints { game_id: GAME_A, address: player, registered_points: 500 });
        world.write_model_test(@PlayerRegisteredPoints { game_id: GAME_B, address: player, registered_points: 900 });
        world.write_model_test(@GameChestReward { game_id: GAME_A, allocated_chests: 5, distributed_chests: 2 });
        world.write_model_test(@GameChestReward { game_id: GAME_B, allocated_chests: 8, distributed_chests: 0 });
        world.write_model_test(@PlayerRank { game_id: GAME_A, player, rank: 1, chests: 2 });
        world.write_model_test(@PlayerRank { game_id: GAME_B, player, rank: 5, chests: 0 });
        world.write_model_test(@GuildMember { game_id: GAME_A, member: player, guild_id: guild });
        world
            .write_model_test(@GuildWhitelist { game_id: GAME_B, guild_id: guild, address: player, whitelisted: true });
        world.write_model_test(@StructureOwnerStats { game_id: GAME_A, owner: player, structures_num: 2 });
        world.write_model_test(@StructureOwnerStats { game_id: GAME_B, owner: player, structures_num: 6 });

        let stored_tile_opt_a: TileOpt = world.read_model((GAME_A, coord.alt, coord.x, coord.y));
        let stored_tile_opt_b: TileOpt = world.read_model((GAME_B, coord.alt, coord.x, coord.y));
        let stored_tile_a: Tile = stored_tile_opt_a.into();
        let stored_tile_b: Tile = stored_tile_opt_b.into();
        let agents_a: AgentCount = world.read_model(GAME_A);
        let agents_b: AgentCount = world.read_model(GAME_B);
        let agent_config_a: AgentConfig = world.read_model(GAME_A);
        let agent_config_b: AgentConfig = world.read_model(GAME_B);
        let settlement_a: BlitzSettlement = world.read_model((GAME_A, player));
        let settlement_b: BlitzSettlement = world.read_model((GAME_B, player));
        let allowance_a: ResourceAllowance = world.read_model((GAME_A, 1, 2, 3));
        let allowance_b: ResourceAllowance = world.read_model((GAME_B, 1, 2, 3));
        let points_a: PlayerRegisteredPoints = world.read_model((GAME_A, player));
        let points_b: PlayerRegisteredPoints = world.read_model((GAME_B, player));
        let chests_a: GameChestReward = world.read_model(GAME_A);
        let chests_b: GameChestReward = world.read_model(GAME_B);
        let rank_a: PlayerRank = world.read_model((GAME_A, player));
        let rank_b: PlayerRank = world.read_model((GAME_B, player));
        let stats_a: StructureOwnerStats = world.read_model((GAME_A, player));
        let stats_b: StructureOwnerStats = world.read_model((GAME_B, player));

        assert!(stored_tile_a.biome == 3, "game A tile changed");
        assert!(stored_tile_b.biome == 7, "game B tile changed");
        assert!(agents_a.count == 4 && agents_b.count == 9, "agent counters crossed games");
        assert!(agent_config_a.max_current_count == 4, "game A agent cap changed");
        assert!(agent_config_b.max_current_count == 8, "game B agent cap changed");
        assert!(*settlement_a.structure_ids.at(0) == 11, "game A settlement changed");
        assert!(*settlement_b.structure_ids.at(0) == 22, "game B settlement changed");
        assert!(allowance_a.amount == 50 && allowance_b.amount == 75, "resource allowances crossed games");
        assert!(points_a.registered_points == 500, "game A points changed");
        assert!(points_b.registered_points == 900, "game B points changed");
        assert!(chests_a.distributed_chests == 2 && chests_b.distributed_chests == 0, "chests crossed games");
        assert!(rank_a.rank == 1 && rank_a.chests == 2, "game A rank changed");
        assert!(rank_b.rank == 5 && rank_b.chests == 0, "game B rank changed");
        assert!(stats_a.structures_num == 2 && stats_b.structures_num == 6, "owner stats crossed games");
        assert!(tile_a.to_seed(111) != tile_b.to_seed(111), "game-scoped VRF salts collided");
        assert!(
            GameRegistryImpl::get(world, GAME_A).end_at != GameRegistryImpl::get(world, GAME_B).end_at,
            "clocks collided",
        );

        let mut ended_a = GameRegistryImpl::get(world, GAME_A);
        ended_a.status = GameStatus::Ended;
        world.write_model_test(@ended_a);
        let live_b = GameRegistryImpl::get(world, GAME_B);
        assert!(live_b.status == GameStatus::Live, "ending game A ended game B");
    }

    #[test]
    #[should_panic(expected: "Eternum: entities belong to different games")]
    fn mixed_game_entities_are_rejected() {
        GameRegistryImpl::assert_same_game(GAME_A, GAME_B);
    }
}


#[cfg(test)]
mod dispatcher_lifecycle {
    use core::num::traits::zero::Zero;
    use dojo::model::{ModelStorage, ModelStorageTest};
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use dojo_snf_test::{
        ContractDef, ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait, get_default_caller_address,
        spawn_test_world,
    };
    use snforge_std::{
        start_cheat_block_timestamp_global, start_cheat_caller_address, start_cheat_chain_id_global,
        stop_cheat_caller_address,
    };
    use starknet::ContractAddress;
    use crate::constants::{DEFAULT_NS, DEFAULT_NS_STR, ResourceTypes, WORLD_CONFIG_ID};
    use crate::models::config::{
        AgentControllerConfig, ArtificerConfig, BankConfig, BattleConfig, BiomeClimateConfig, BitcoinMineConfig,
        BlitzExplorationConfig, BlitzRegistrationConfigImpl, BlitzRegistrationGameConfig, BlitzRegistrationRulesConfig,
        BlitzSettlementConfig, BuildingConfig, ChainConfig, FaithConfig, HyperstructureConfig, HyperstructureCostConfig,
        PresetConfig, PresetGameConfig, QuestConfig, ResourceBridgeConfig, ResourceBridgeFeeSplitConfig,
        SettlementConfig, SpeedConfig, StartingResourcesConfig, StructureMaxLevelConfig, TickConfig, TradeConfig,
        VictoryPointsGrantConfig, VictoryPointsWinConfig, VillageFoundResourcesConfig, VillageTroopConfig, WeightConfig,
    };
    use crate::models::game::{GameRegistryImpl, GameStatus};
    use crate::models::rank::{PlayerRank, PlayersRankTrial, RankList, RankPrize};
    use crate::models::resource::resource::{ResourceAllowance, ResourceImpl, ResourceMinMaxList};
    use crate::systems::prize_distribution::contracts::{
        IPrizeDistributionSystemsDispatcher, IPrizeDistributionSystemsDispatcherTrait,
    };
    use crate::systems::realm::blitz::contracts::{IBlitzRealmSystemsDispatcher, IBlitzRealmSystemsDispatcherTrait};
    use crate::systems::registrar::contracts::{
        CreateGameParams, IRegistrarSystemsDispatcher, IRegistrarSystemsDispatcherTrait, PresetSideTables,
    };
    use crate::systems::resources::contracts::resource_systems::{
        IResourceSystemsDispatcher, IResourceSystemsDispatcherTrait,
    };
    use crate::systems::utils::camp::iCampDiscoveryImpl;
    use crate::utils::testing::helpers::{
        MOCK_CAPACITY_CONFIG, MOCK_MAP_CONFIG, MOCK_STRUCTURE_CAPACITY_CONFIG, TEST_PRESET_ID,
    };

    const GAME_A: u32 = 1;
    const GAME_B: u32 = 2;
    const SERIES_ID: felt252 = 'series';
    const RESOURCE_LIST_ID: u32 = 77;
    const RESOURCE_AMOUNT: u128 = 25;

    #[derive(Drop)]
    struct LifecycleContext {
        world: WorldStorage,
        registrar: IRegistrarSystemsDispatcher,
        blitz: IBlitzRealmSystemsDispatcher,
        resources: IResourceSystemsDispatcher,
        player: ContractAddress,
    }

    fn lifecycle_namespace() -> NamespaceDef {
        NamespaceDef {
            namespace: DEFAULT_NS_STR(),
            resources: [
                TestResource::Model("ChainConfig"), TestResource::Model("GameCounter"), TestResource::Model("Preset"),
                TestResource::Model("Series"), TestResource::Model("PresetConfig"),
                TestResource::Model("PresetGameConfig"), TestResource::Model("WorldConfig"),
                TestResource::Model("GameMapConfig"), TestResource::Model("GameRegistry"),
                TestResource::Model("AgentConfig"), TestResource::Model("TileOpt"),
                TestResource::Model("BlitzSettlementPosition"), TestResource::Model("BlitzSettlement"),
                TestResource::Model("BlitzCosmeticAttrsRegister"), TestResource::Model("Structure"),
                TestResource::Model("StructureOwnerStats"), TestResource::Model("Resource"),
                TestResource::Model("WeightConfig"), TestResource::Model("ResourceMinMaxList"),
                TestResource::Model("ResourceAllowance"), TestResource::Model("ResourceArrival"),
                TestResource::Model("Wonder"), TestResource::Model("AddressName"), TestResource::Model("RNG"),
                TestResource::Model("PlayersRankTrial"), TestResource::Model("PlayerRank"),
                TestResource::Model("RankPrize"), TestResource::Model("RankList"), TestResource::Model("QuestLevels"),
                TestResource::Model("QuestGameRegistry"), TestResource::Model("QuestFeatureFlag"),
                TestResource::Contract("registrar_systems"), TestResource::Contract("hyperstructure_create_systems"),
                TestResource::Contract("blitz_realm_systems"), TestResource::Contract("realm_systems"),
                TestResource::Contract("realm_internal_systems"), TestResource::Contract("prize_distribution_systems"),
                TestResource::Contract("resource_systems"),
                TestResource::Library(("structure_creation_library", "0_1_18")),
                TestResource::Library(("rng_library", "0_1_16")), TestResource::Event("GameCreated"),
                TestResource::Event("BlitzSettlementEvent"), TestResource::Event("StoryEvent"),
                TestResource::Event("BurnDonkey"), TestResource::Event("Transfer"),
                TestResource::Event("TrophyProgression"),
            ]
                .span(),
        }
    }

    fn lifecycle_contracts() -> Span<ContractDef> {
        let namespace = dojo::utils::bytearray_hash(DEFAULT_NS());
        [
            ContractDefTrait::new(DEFAULT_NS(), @"registrar_systems").with_writer_of([namespace].span()),
            ContractDefTrait::new(DEFAULT_NS(), @"hyperstructure_create_systems").with_writer_of([namespace].span()),
            ContractDefTrait::new(DEFAULT_NS(), @"blitz_realm_systems").with_writer_of([namespace].span()),
            ContractDefTrait::new(DEFAULT_NS(), @"realm_systems").with_writer_of([namespace].span()),
            ContractDefTrait::new(DEFAULT_NS(), @"realm_internal_systems").with_writer_of([namespace].span()),
            ContractDefTrait::new(DEFAULT_NS(), @"prize_distribution_systems").with_writer_of([namespace].span()),
            ContractDefTrait::new(DEFAULT_NS(), @"resource_systems").with_writer_of([namespace].span()),
        ]
            .span()
    }

    fn setup_lifecycle() -> LifecycleContext {
        let player = get_default_caller_address();
        let world = spawn_lifecycle_world();
        let registrar = registrar_dispatcher(world);
        let blitz = blitz_dispatcher(world);
        let resources = resource_dispatcher(world);

        register_lifecycle(registrar, player);
        enter_lifecycle_games(blitz, player);

        LifecycleContext { world, registrar, blitz, resources, player }
    }

    fn spawn_lifecycle_world() -> WorldStorage {
        start_cheat_chain_id_global('TEST');
        let mut world = spawn_test_world([lifecycle_namespace()].span());
        world.sync_perms_and_inits(lifecycle_contracts());
        world
    }

    fn register_lifecycle(registrar: IRegistrarSystemsDispatcher, player: ContractAddress) {
        registrar.bootstrap_chain_config(chain_config(player));
        registrar.register_preset(preset_config(), preset_game_config(), preset_side_tables());
        registrar.register_series(SERIES_ID, player, 2, 0, 10_000);
        registrar.create_game(create_game_params(1, 111));
        registrar.create_game(create_game_params(2, 222));
    }

    fn enter_lifecycle_games(blitz: IBlitzRealmSystemsDispatcher, player: ContractAddress) {
        start_cheat_caller_address(blitz.contract_address, player);
        blitz.settle(GAME_A, 'player-a', [].span(), false);
        blitz.settle(GAME_B, 'player-b', [].span(), false);
        stop_cheat_caller_address(blitz.contract_address);
    }

    #[test]
    fn two_game_dispatchers_keep_registration_and_actions_isolated() {
        let mut context = setup_lifecycle();
        let settlement_a: crate::models::config::BlitzSettlement = context.world.read_model((GAME_A, context.player));
        let settlement_b: crate::models::config::BlitzSettlement = context.world.read_model((GAME_B, context.player));
        let owner_a = *settlement_a.structure_ids.at(0);
        let recipient_a = *settlement_a.structure_ids.at(1);
        let owner_b = *settlement_b.structure_ids.at(0);
        let recipient_b = *settlement_b.structure_ids.at(1);

        iCampDiscoveryImpl::grant_starting_resources(ref context.world, GAME_A, owner_a);
        iCampDiscoveryImpl::grant_starting_resources(ref context.world, GAME_A, recipient_a);
        iCampDiscoveryImpl::grant_starting_resources(ref context.world, GAME_B, owner_b);
        iCampDiscoveryImpl::grant_starting_resources(ref context.world, GAME_B, recipient_b);

        start_cheat_caller_address(context.resources.contract_address, context.player);
        context.resources.approve(GAME_A, owner_a, recipient_a, [(ResourceTypes::WOOD, 10)].span());
        context.resources.approve(GAME_B, owner_b, recipient_b, [(ResourceTypes::WOOD, 10)].span());
        context.resources.pickup(GAME_A, recipient_a, owner_a, [(ResourceTypes::WOOD, 10)].span());
        stop_cheat_caller_address(context.resources.contract_address);

        let registration_a = BlitzRegistrationConfigImpl::get(context.world, GAME_A);
        let registration_b = BlitzRegistrationConfigImpl::get(context.world, GAME_B);
        assert!(registration_a.registration_count == 1, "game A entry failed");
        assert!(registration_b.registration_count == 1, "game B entry failed");
        assert!(owner_a != owner_b, "structure ids crossed games");
        assert!(ResourceImpl::read_balance(ref context.world, GAME_A, owner_a, ResourceTypes::WOOD) == 15);

        let allowance_a: ResourceAllowance = context
            .world
            .read_model((GAME_A, owner_a, recipient_a, ResourceTypes::WOOD));
        let allowance_b: ResourceAllowance = context
            .world
            .read_model((GAME_B, owner_b, recipient_b, ResourceTypes::WOOD));
        assert!(allowance_a.amount == 0, "game A pickup did not spend allowance");
        assert!(allowance_b.amount == 10, "game A pickup changed game B allowance");
    }

    #[test]
    #[should_panic]
    fn spoofed_game_id_cannot_pick_up_another_games_allowance() {
        let mut context = setup_lifecycle();
        let settlement_a: crate::models::config::BlitzSettlement = context.world.read_model((GAME_A, context.player));
        let owner_a = *settlement_a.structure_ids.at(0);
        let recipient_a = *settlement_a.structure_ids.at(1);

        iCampDiscoveryImpl::grant_starting_resources(ref context.world, GAME_A, owner_a);
        iCampDiscoveryImpl::grant_starting_resources(ref context.world, GAME_A, recipient_a);
        start_cheat_caller_address(context.resources.contract_address, context.player);
        context.resources.approve(GAME_A, owner_a, recipient_a, [(ResourceTypes::WOOD, 1)].span());
        context.resources.pickup(GAME_B, recipient_a, owner_a, [(ResourceTypes::WOOD, 1)].span());
    }

    #[test]
    #[should_panic]
    fn spoofed_game_id_cannot_send_from_another_games_structure() {
        let mut context = setup_lifecycle();
        let settlement_a: crate::models::config::BlitzSettlement = context.world.read_model((GAME_A, context.player));
        let owner_a = *settlement_a.structure_ids.at(0);
        let recipient_a = *settlement_a.structure_ids.at(1);

        start_cheat_caller_address(context.resources.contract_address, context.player);
        context.resources.send(GAME_B, owner_a, recipient_a, [(ResourceTypes::WOOD, 1)].span());
    }

    #[test]
    fn chain_admin_can_reset_an_abandoned_unfinalized_trial() {
        let mut context = setup_lifecycle();
        seed_unfinalized_trial(ref context);

        context.registrar.reset_trial(GAME_A);

        let trial: PlayersRankTrial = context.world.read_model(GAME_A);
        let player_rank: PlayerRank = context.world.read_model((GAME_A, context.player));
        let rank_prize: RankPrize = context.world.read_model((GAME_A, 1_u16));
        let rank_list: RankList = context.world.read_model((GAME_A, 1_u16, 0_u16));
        assert!(trial.owner.is_zero(), "trial was not cleared");
        assert!(player_rank.rank == 0, "player rank was not cleared");
        assert!(rank_prize.total_players_same_rank_count == 0, "rank prize was not cleared");
        assert!(rank_list.player.is_zero(), "rank list was not cleared");
    }

    #[test]
    fn admin_settlement_ends_dev_game() {
        let context = setup_lifecycle();
        start_cheat_block_timestamp_global(311);

        context.registrar.mark_game_settled(GAME_B);

        let game = GameRegistryImpl::get(context.world, GAME_B);
        assert!(game.status == GameStatus::Settled, "dev game was not settled");
    }

    // A dev-off game created on a chain whose ledger operator is `ledger_operator`.
    fn setup_dev_off_game(ledger_operator: ContractAddress) -> LifecycleContext {
        let player = get_default_caller_address();
        let world = spawn_lifecycle_world();
        let registrar = registrar_dispatcher(world);
        let blitz = blitz_dispatcher(world);
        let resources = resource_dispatcher(world);

        registrar.bootstrap_chain_config(chain_config_with_ledger_operator(player, ledger_operator));
        registrar.register_preset(preset_config(), preset_game_config(), preset_side_tables());
        registrar.register_series(SERIES_ID, player, 2, 0, 10_000);
        let mut params = create_game_params(1, 111);
        params.dev_mode_on = false;
        registrar.create_game(params);

        LifecycleContext { world, registrar, blitz, resources, player }
    }

    fn settle_inside_registration_window(context: @LifecycleContext) {
        start_cheat_block_timestamp_global(150);
        start_cheat_caller_address(*context.blitz.contract_address, *context.player);
        (*context.blitz).settle(GAME_A, 'player-a', [].span(), false);
        stop_cheat_caller_address(*context.blitz.contract_address);
    }

    #[test]
    fn dev_off_game_settles_without_a_ledger_when_no_operator_is_configured() {
        let context = setup_dev_off_game(Zero::zero());

        settle_inside_registration_window(@context);

        let settlement: crate::models::config::BlitzSettlement = context.world.read_model((GAME_A, context.player));
        assert!(settlement.structure_ids.len() > 0, "dev-off player could not settle without a ledger");
    }

    #[test]
    #[should_panic(expected: "Eternum: player registry is not configured")]
    fn dev_off_game_takes_the_ledger_path_when_an_operator_is_configured() {
        let context = setup_dev_off_game('operator'.try_into().unwrap());

        settle_inside_registration_window(@context);
    }

    #[test]
    fn admin_clears_the_ledger_operator_to_open_entry() {
        let context = setup_dev_off_game('operator'.try_into().unwrap());

        context.registrar.set_ledger_operator(Zero::zero());
        settle_inside_registration_window(@context);

        let chain_config: ChainConfig = context.world.read_model(WORLD_CONFIG_ID);
        assert!(chain_config.ledger_operator_address.is_zero(), "ledger operator was not cleared");
        let settlement: crate::models::config::BlitzSettlement = context.world.read_model((GAME_A, context.player));
        assert!(settlement.structure_ids.len() > 0, "entry did not open after clearing the operator");
    }

    #[test]
    #[should_panic(expected: "Eternum: caller is not admin")]
    fn only_the_admin_changes_the_ledger_operator() {
        let context = setup_dev_off_game('operator'.try_into().unwrap());

        start_cheat_caller_address(context.registrar.contract_address, 'attacker'.try_into().unwrap());
        context.registrar.set_ledger_operator(Zero::zero());
    }

    #[test]
    #[should_panic(expected: "Eternum: registration must open before settling")]
    fn game_registration_must_open_before_settling() {
        let context = setup_lifecycle();
        let mut params = create_game_params(3, 333);
        params.registration_start_at = params.start_settling_at.try_into().unwrap();
        context.registrar.create_game(params);
    }

    #[test]
    #[should_panic(expected: "Eternum: series chest allocation exceeds u16")]
    fn series_registration_rejects_chest_allocations_that_exceed_storage() {
        let context = setup_lifecycle();
        context.registrar.register_series('overflow', context.player, 1, 65_536, 10_000);
    }

    #[test]
    #[should_panic]
    fn preset_registration_rejects_unknown_blitz_reward_profile() {
        let context = setup_lifecycle();
        let mut preset = preset_config();
        let mut game_config = preset_game_config();
        preset.preset_id = 3;
        preset.blitz_exploration_config.reward_profile_id = 99;
        game_config.preset_id = 3;
        context.registrar.register_preset(preset, game_config, preset_side_tables());
    }

    #[test]
    #[should_panic(expected: "Eternum: caller is not the world owner")]
    fn non_owner_cannot_front_run_chain_bootstrap() {
        let attacker: ContractAddress = 'attacker'.try_into().unwrap();
        let mut world = spawn_test_world([lifecycle_namespace()].span());
        world.sync_perms_and_inits(lifecycle_contracts());
        let registrar = registrar_dispatcher(world);
        start_cheat_caller_address(registrar.contract_address, attacker);

        registrar.bootstrap_chain_config(chain_config(attacker));
    }

    #[test]
    #[should_panic(expected: "Eternum: caller is not admin")]
    fn non_admin_cannot_squat_the_next_game_id() {
        let context = setup_lifecycle();
        let attacker: ContractAddress = 'attacker'.try_into().unwrap();
        let mut params = create_game_params(3, 333);
        params.series_id = 0;
        params.game_number_in_series = 0;
        params.dev_mode_on = false;
        start_cheat_caller_address(context.registrar.contract_address, attacker);

        context.registrar.create_game(params);
    }

    #[test]
    #[should_panic(expected: "Eternum: caller is not admin")]
    fn caller_cannot_enable_dev_mode_on_a_production_preset() {
        let context = setup_lifecycle();
        let attacker: ContractAddress = 'attacker'.try_into().unwrap();
        let mut params = create_game_params(3, 333);
        params.series_id = 0;
        params.game_number_in_series = 0;
        params.dev_mode_on = true;
        start_cheat_caller_address(context.registrar.contract_address, attacker);

        context.registrar.create_game(params);
    }

    #[test]
    #[should_panic(expected: "Eternum: ranked player is not settled")]
    fn zero_point_unsettled_substitution_cannot_finalize_roster() {
        let mut context = setup_lifecycle();
        let mut game = GameRegistryImpl::get(context.world, GAME_A);
        game.dev_mode_on = false;
        game.end_at = 300;
        context.world.write_model_test(@game);
        start_cheat_block_timestamp_global(311);

        let attacker: ContractAddress = 'bound_attacker'.try_into().unwrap();
        let prize = prize_dispatcher(context.world);
        start_cheat_caller_address(prize.contract_address, attacker);
        prize.blitz_prize_player_rank(GAME_A, 88, 1, array![attacker]);
    }

    fn seed_unfinalized_trial(ref context: LifecycleContext) {
        context
            .world
            .write_model_test(
                @PlayersRankTrial {
                    game_id: GAME_A,
                    nonce: 77,
                    owner: context.player,
                    last_rank: 1,
                    last_player_points: 10,
                    total_player_points: 10,
                    total_player_count_committed: 2,
                    total_player_count_revealed: 1,
                },
            );
        context.world.write_model_test(@PlayerRank { game_id: GAME_A, player: context.player, rank: 1, chests: 0 });
        context
            .world
            .write_model_test(
                @RankPrize { game_id: GAME_A, rank: 1, total_players_same_rank_count: 1, grant_elite_nft: false },
            );
        context.world.write_model_test(@RankList { game_id: GAME_A, rank: 1, index: 0, player: context.player });
    }

    fn registrar_dispatcher(world: WorldStorage) -> IRegistrarSystemsDispatcher {
        let (address, _) = world.dns(@"registrar_systems").unwrap();
        IRegistrarSystemsDispatcher { contract_address: address }
    }

    fn blitz_dispatcher(world: WorldStorage) -> IBlitzRealmSystemsDispatcher {
        let (address, _) = world.dns(@"blitz_realm_systems").unwrap();
        IBlitzRealmSystemsDispatcher { contract_address: address }
    }

    fn resource_dispatcher(world: WorldStorage) -> IResourceSystemsDispatcher {
        let (address, _) = world.dns(@"resource_systems").unwrap();
        IResourceSystemsDispatcher { contract_address: address }
    }

    fn prize_dispatcher(world: WorldStorage) -> IPrizeDistributionSystemsDispatcher {
        let (address, _) = world.dns(@"prize_distribution_systems").unwrap();
        IPrizeDistributionSystemsDispatcher { contract_address: address }
    }

    // The lab chain has no value plane: no ledger operator, so entry is open.
    fn chain_config(admin: ContractAddress) -> ChainConfig {
        chain_config_with_ledger_operator(admin, Zero::zero())
    }

    fn chain_config_with_ledger_operator(admin: ContractAddress, ledger_operator: ContractAddress) -> ChainConfig {
        ChainConfig {
            config_id: 0,
            admin_address: admin,
            ledger_operator_address: ledger_operator,
            player_registry_address: Zero::zero(),
            vrf_provider_address: Zero::zero(),
            agent_controller_config: AgentControllerConfig { address: Zero::zero() },
            collectibles_cosmetics_address: Zero::zero(),
            collectibles_timelock_address: Zero::zero(),
            collectibles_lootchest_address: Zero::zero(),
            collectibles_elitenft_address: Zero::zero(),
        }
    }

    fn preset_config() -> PresetConfig {
        PresetConfig {
            preset_id: TEST_PRESET_ID,
            hyperstructure_config: HyperstructureConfig { initialize_shards_amount: 0 },
            hyperstructure_cost_config: HyperstructureCostConfig { construction_resources_ids: [].span() },
            speed_config: SpeedConfig { donkey_sec_per_km: 1, donkey_sec_per_km_troops: 1 },
            map_config: MOCK_MAP_CONFIG(),
            tick_config: TickConfig {
                armies_tick_in_seconds: 1, delivery_tick_in_seconds: 1, bitcoin_phase_in_seconds: 600,
            },
            structure_max_level_config: StructureMaxLevelConfig { realm_max: 1, village_max: 1 },
            building_config: BuildingConfig { base_population: 0, base_cost_percent_increase: 0 },
            troop_damage_config: Default::default(),
            troop_stamina_config: Default::default(),
            troop_limit_config: Default::default(),
            capacity_config: MOCK_CAPACITY_CONFIG(),
            battle_config: BattleConfig {
                regular_immunity_ticks: 0, village_immunity_ticks: 0, village_raid_immunity_ticks: 0,
            },
            bank_config: BankConfig { lp_fee_num: 0, lp_fee_denom: 1, owner_fee_num: 0, owner_fee_denom: 1 },
            trade_config: TradeConfig { max_count: 0 },
            quest_config: QuestConfig { quest_discovery_prob: 0, quest_discovery_fail_prob: 0 },
            faith_config: FaithConfig {
                enabled: false,
                wonder_base_fp_per_sec: 0,
                holy_site_fp_per_sec: 0,
                realm_fp_per_sec: 0,
                village_fp_per_sec: 0,
                owner_share_percent: 0,
                reward_token: Zero::zero(),
            },
            bitcoin_mine_config: BitcoinMineConfig {
                enabled: false, prize_per_phase: 0, min_labor_per_contribution: 1,
            },
            resource_bridge_config: ResourceBridgeConfig { deposit_paused: false, withdraw_paused: false },
            res_bridge_fee_split_config: ResourceBridgeFeeSplitConfig {
                velords_fee_on_dpt_percent: 0,
                velords_fee_on_wtdr_percent: 0,
                season_pool_fee_on_dpt_percent: 0,
                season_pool_fee_on_wtdr_percent: 0,
                client_fee_on_dpt_percent: 0,
                client_fee_on_wtdr_percent: 0,
                realm_fee_dpt_percent: 0,
                realm_fee_wtdr_percent: 0,
                velords_fee_recipient: Zero::zero(),
                season_pool_fee_recipient: Zero::zero(),
            },
            village_troop_config: VillageTroopConfig { troop_delay_ticks: 0 },
            quest_games: [].span(),
            realm_start_resources_config: StartingResourcesConfig { resources_list_id: 0, resources_list_count: 0 },
            village_start_resources_config: StartingResourcesConfig { resources_list_id: 0, resources_list_count: 0 },
            village_find_resources_config: VillageFoundResourcesConfig {
                resources_mm_list_id: RESOURCE_LIST_ID, resources_mm_list_count: 2,
            },
            structure_capacity_config: MOCK_STRUCTURE_CAPACITY_CONFIG(),
            victory_points_grant_config: VictoryPointsGrantConfig {
                hyp_points_per_second: 0,
                claim_hyperstructure_points: 0,
                claim_otherstructure_points: 0,
                explore_tiles_points: 0,
                relic_open_points: 0,
            },
            victory_points_win_config: VictoryPointsWinConfig { points_for_win: 0 },
            blitz_exploration_config: BlitzExplorationConfig { reward_profile_id: 2 },
            artificer_config: ArtificerConfig { research_cost_for_relic: 0 },
            blitz_registration_rules_config: BlitzRegistrationRulesConfig { collectibles_cosmetics_max: 0 },
            mercenaries_name: 0,
        }
    }

    fn preset_game_config() -> PresetGameConfig {
        PresetGameConfig {
            preset_id: TEST_PRESET_ID,
            blitz_mode_on: true,
            settlement_config: SettlementConfig {
                center: 0,
                base_distance: 0,
                layers_skipped: 0,
                layer_max: 0,
                layer_capacity_increment: 0,
                layer_capacity_bps: 0,
                spires_layer_distance: 0,
                spires_max_count: 0,
                spires_settled_count: 0,
            },
            blitz_settlement_config: BlitzSettlementConfig {
                base_distance: 8,
                side: 0,
                step: 1,
                point: 1,
                open_settlement_count: 0,
                single_realm_mode: false,
                two_player_mode: false,
            },
            blitz_registration_config: BlitzRegistrationGameConfig {
                registration_count: 0, registration_count_max: 1, registration_start_at: 10,
            },
            agent_max_lifetime_count: 0,
            agent_max_current_count: 0,
            agent_min_spawn_lords_amount: 0,
            agent_max_spawn_lords_amount: 0,
        }
    }

    fn preset_side_tables() -> PresetSideTables {
        PresetSideTables {
            weights: [
                WeightConfig { preset_id: 0, resource_type: ResourceTypes::WOOD, weight_gram: 1 },
                WeightConfig { preset_id: 0, resource_type: ResourceTypes::DONKEY, weight_gram: 1 },
            ]
                .span(),
            resource_factories: [].span(),
            building_categories: [].span(),
            structure_levels: [].span(),
            hyperstructure_construction: [].span(),
            resource_lists: [].span(),
            resource_min_max_lists: [
                ResourceMinMaxList {
                    preset_id: 0,
                    entity_id: RESOURCE_LIST_ID,
                    index: 0,
                    resource_type: ResourceTypes::WOOD,
                    min_amount: RESOURCE_AMOUNT,
                    max_amount: RESOURCE_AMOUNT,
                },
                ResourceMinMaxList {
                    preset_id: 0,
                    entity_id: RESOURCE_LIST_ID,
                    index: 1,
                    resource_type: ResourceTypes::DONKEY,
                    min_amount: 10_000_000_000,
                    max_amount: 10_000_000_000,
                },
            ]
                .span(),
        }
    }

    fn create_game_params(game_number_in_series: u16, seed: felt252) -> CreateGameParams {
        CreateGameParams {
            name: if game_number_in_series == 1 {
                'game-a'
            } else {
                'game-b'
            },
            preset_id: TEST_PRESET_ID,
            series_id: SERIES_ID,
            game_number_in_series,
            start_settling_at: 100,
            start_main_at: 200,
            duration_seconds: 100,
            end_grace_seconds: 10,
            registration_grace_seconds: 10,
            dev_mode_on: true,
            single_realm_mode: false,
            two_player_mode: false,
            registration_count_max: 1,
            registration_start_at: 10,
            biome_climate_config: BiomeClimateConfig {
                elevation_scale_bps: 10_000,
                moisture_scale_bps: 10_000,
                elevation_bias_bps: 0,
                moisture_bias_bps: 0,
                elevation_seed: seed.try_into().unwrap(),
                moisture_seed: (seed + 1).try_into().unwrap(),
            },
            use_map_override: false,
            map_override: MOCK_MAP_CONFIG(),
            seed,
        }
    }
}
