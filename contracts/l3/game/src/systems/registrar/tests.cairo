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
            registration_grace_seconds: 0,
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
        ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp_global, start_cheat_caller_address,
        start_cheat_chain_id_global, stop_cheat_caller_address,
    };
    use starknet::ContractAddress;
    use crate::constants::{DEFAULT_NS, DEFAULT_NS_STR, ResourceTypes, WORLD_CONFIG_ID};
    use crate::models::config::{
        AgentControllerConfig, ArtificerConfig, BankConfig, BattleConfig, BiomeClimateConfig, BitcoinMineConfig,
        BlitzExplorationConfig, BlitzRegistrationConfigImpl, BlitzRegistrationGameConfig, BlitzRegistrationRulesConfig,
        BlitzSettlementConfig, BuildingConfig, ChainConfig, FaithConfig, HyperstructureConfig, HyperstructureCostConfig,
        PresetConfig, PresetGameConfig, ResourceBridgeConfig, ResourceBridgeFeeSplitConfig, SettlementConfig,
        SpeedConfig, StartingResourcesConfig, StructureMaxLevelConfig, TickConfig, TradeConfig,
        VictoryPointsGrantConfig, VictoryPointsWinConfig, VillageFoundResourcesConfig, VillageTroopConfig, WeightConfig,
        WorldConfigUtilImpl,
    };
    use crate::models::game::{GameRegistryImpl, GameStatus};
    use crate::models::hyperstructure::{
        CompletedHyperstructureImpl, Hyperstructure, HyperstructureShareholders, PlayerRegisteredPoints,
    };
    use crate::models::map2::TileOpt;
    use crate::models::position::{CoordTrait, DirectionTrait};
    use crate::models::rank::{PlayerRank, PlayersRankTrial, RankList, RankPrize};
    use crate::models::resource::resource::{ResourceAllowance, ResourceImpl, ResourceMinMaxList};
    use crate::models::season::SeasonPrize;
    use crate::models::series_chest_reward::{GameChestReward, SeriesChestRewardState};
    use crate::systems::bank::contracts::{IBankSystemsDispatcher, IBankSystemsDispatcherTrait};
    use crate::systems::prize_distribution::contracts::{
        IPrizeDistributionSystemsDispatcher, IPrizeDistributionSystemsDispatcherTrait,
    };
    use crate::systems::realm::blitz::contracts::{IBlitzRealmSystemsDispatcher, IBlitzRealmSystemsDispatcherTrait};
    use crate::systems::realm::season::contracts::IRealmSystemsDispatcherTrait;
    use crate::systems::registrar::contracts::{
        CreateGameParams, IRegistrarSystemsDispatcher, IRegistrarSystemsDispatcherTrait, PresetSideTables,
    };
    use crate::systems::resources::contracts::resource_systems::{
        IResourceSystemsDispatcher, IResourceSystemsDispatcherTrait,
    };
    use crate::systems::season::contracts::{ISeasonSystemsDispatcher, ISeasonSystemsDispatcherTrait};
    use crate::systems::trade::contracts::{ITradeSystemsDispatcher, ITradeSystemsDispatcherTrait};
    use crate::systems::utils::camp::iCampDiscoveryImpl;
    use crate::systems::utils::series_chest_reward::series_chest_reward_calculator::SeriesChestRewardStateImpl;
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
                TestResource::Model("RankPrize"), TestResource::Model("RankList"),
                TestResource::Model("Hyperstructure"), TestResource::Model("HyperstructureShareholders"),
                TestResource::Model("SeriesChestRewardState"), TestResource::Model("SharePointsCheckpoint"),
                TestResource::Model("HyperstructureGlobals"), TestResource::Model("CompletedHyperstructure"),
                TestResource::Model("HyperstructureIndex"), TestResource::Model("PlayerRegisteredPoints"),
                TestResource::Model("SeasonPrize"), TestResource::Model("GameChestReward"),
                TestResource::Model("PlayerSettlement"), TestResource::Model("RealmAllocationPool"),
                TestResource::Model("RealmAllocationSlot"), TestResource::Model("RealmAllocation"),
                TestResource::Model("LedgerRegistration"), TestResource::Model("StructureVillageSlots"),
                TestResource::Model("StructureBuildings"), TestResource::Model("Building"),
                TestResource::Model("BuildingCategoryConfig"), TestResource::Model("ResourceFactoryConfig"),
                TestResource::Model("ProductionBoostBonus"), TestResource::Model("ResourceList"),
                TestResource::Contract("registrar_systems"), TestResource::Contract("hyperstructure_create_systems"),
                TestResource::Contract("blitz_realm_systems"), TestResource::Contract("realm_systems"),
                TestResource::Contract("realm_internal_systems"), TestResource::Contract("prize_distribution_systems"),
                TestResource::Contract("resource_systems"), TestResource::Contract("bank_systems"),
                TestResource::Contract("trade_systems"), TestResource::Contract("season_systems"),
                TestResource::Library(("structure_creation_library", "0_1_18")),
                TestResource::Library(("rng_library", "0_1_16")), TestResource::Library(("biome_library", "0_1_13")),
                TestResource::Event("GameCreated"), TestResource::Event("BlitzSettlementEvent"),
                TestResource::Event("StoryEvent"), TestResource::Event("BurnDonkey"), TestResource::Event("Transfer"),
                TestResource::Event("LedgerResultRowReady"), TestResource::Event("LedgerResultsReady"),
                TestResource::Event("SeasonEnded"),
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
            ContractDefTrait::new(DEFAULT_NS(), @"season_systems").with_writer_of([namespace].span()),
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

    #[test]
    #[should_panic(expected: "Eternum: feature is disabled in Blitz")]
    fn bank_creation_is_disabled_in_blitz() {
        let context = setup_lifecycle();
        let (address, _) = context.world.dns(@"bank_systems").unwrap();
        IBankSystemsDispatcher { contract_address: address }.create_banks(GAME_A, [].span());
    }

    #[test]
    #[should_panic(expected: "Eternum: feature is disabled in Blitz")]
    fn trade_is_disabled_in_blitz() {
        let context = setup_lifecycle();
        let (address, _) = context.world.dns(@"trade_systems").unwrap();
        ITradeSystemsDispatcher { contract_address: address }.cancel_order(GAME_A, 1);
    }

    fn setup_eternum_game() -> (LifecycleContext, crate::systems::realm::season::contracts::IRealmSystemsDispatcher) {
        setup_eternum_game_with_spires(1)
    }

    fn setup_eternum_game_with_spires(
        count: u16,
    ) -> (LifecycleContext, crate::systems::realm::season::contracts::IRealmSystemsDispatcher) {
        setup_eternum_game_with_spire_spacing(count, 15)
    }

    fn setup_eternum_game_with_spire_spacing(
        count: u16, spacing: u8,
    ) -> (LifecycleContext, crate::systems::realm::season::contracts::IRealmSystemsDispatcher) {
        let player = get_default_caller_address();
        let world = spawn_lifecycle_world();
        let registrar = registrar_dispatcher(world);
        registrar.bootstrap_chain_config(chain_config_with_ledger_operator(player, Zero::zero()));
        let mut rules = preset_game_config();
        rules.blitz_mode_on = false;
        rules.settlement_config.spires_max_count = count;
        rules.settlement_config.base_distance = spacing;
        rules.settlement_config.spires_layer_distance = 1;
        rules.settlement_config.layer_max = 2;
        let mut tables = preset_side_tables();
        tables
            .resource_factories =
                [
                    crate::models::config::ResourceFactoryConfig {
                        preset_id: 0,
                        resource_type: ResourceTypes::LABOR,
                        realm_output_per_second: 1000000,
                        village_output_per_second: 1000000,
                        labor_output_per_resource: 0,
                        output_per_simple_input: 0,
                        output_per_complex_input: 0,
                        simple_input_list_id: 0,
                        complex_input_list_id: 0,
                        simple_input_list_count: 0,
                        complex_input_list_count: 0,
                    }
                ]
            .span();
        registrar.register_preset(preset_config(), rules, tables);
        registrar.register_series(SERIES_ID, player, 2, 0, 10_000);
        let mut params = create_game_params(1, 111);
        params.dev_mode_on = false;
        params.registration_count_max = 0;
        params.two_player_mode = false;
        registrar.create_game(params);
        let (address, _) = world.dns(@"realm_systems").unwrap();
        let season = crate::systems::realm::season::contracts::IRealmSystemsDispatcher { contract_address: address };
        (
            LifecycleContext {
                world, registrar, blitz: blitz_dispatcher(world), resources: resource_dispatcher(world), player,
            },
            season,
        )
    }

    #[test]
    fn eternum_open_entry_settles_after_main_start_with_canonical_metadata() {
        let (context, season) = setup_eternum_game();
        start_cheat_block_timestamp_global(250);
        let structure_id = season.settle(GAME_A, 'late-player');
        let structure: crate::models::structure::Structure = context.world.read_model((GAME_A, structure_id));
        let metadata = structure.metadata;
        let (wonder, order, resources) = crate::systems::utils::realm_metadata::realm_attributes(
            metadata.realm_id.into(),
        );
        assert!(
            structure
                .resources_packed == crate::models::structure::StructureResourcesImpl::pack_resource_types(
                    resources.span(),
                ),
            "canonical production traits were lost",
        );
        assert!(metadata.order == order, "canonical Order was lost");
        assert!(metadata.has_wonder == (wonder != 1), "canonical wonder was lost");
        let reservation: crate::models::ledger::PlayerSettlement = context.world.read_model((GAME_A, context.player));
        assert!(reservation.structure_id == structure_id, "settlement entitlement not consumed");
    }

    #[test]
    #[should_panic(expected: "Eternum: Player is already settled")]
    fn eternum_open_entry_cannot_settle_twice() {
        let (_, season) = setup_eternum_game();
        start_cheat_block_timestamp_global(250);
        season.settle(GAME_A, 'first');
        season.settle(GAME_A, 'second');
    }

    fn bind_eternum_entry_owner(ref context: LifecycleContext, paid: bool) {
        let (registry, _) = declare("SharedOwnerRegistryMock").unwrap().contract_class().deploy(@array![]).unwrap();
        let mut chain: ChainConfig = context.world.read_model(WORLD_CONFIG_ID);
        chain.player_registry_address = registry;
        if paid {
            chain.ledger_operator_address = context.player;
        }
        context.world.write_model_test(@chain);
        context
            .world
            .write_model_test(
                @crate::models::ledger::LedgerRegistration {
                    game_id: GAME_A,
                    owner: 123.try_into().unwrap(),
                    realm_id: 87,
                    // Seven attribute bytes: geography, Coal, Twins, Eternal Orchard.
                    metadata: (0x20502010101010007, 0, 0),
                    pass_kind: 1,
                    registered: true,
                },
            );
    }

    #[test]
    fn eternum_paid_entry_preserves_registered_realm_metadata() {
        let (mut context, season) = setup_eternum_game();
        bind_eternum_entry_owner(ref context, true);
        start_cheat_block_timestamp_global(250);
        let id = season.settle(GAME_A, 'paid-player');
        let structure: crate::models::structure::Structure = context.world.read_model((GAME_A, id));
        assert!(
            structure.metadata.realm_id == 87 && structure.metadata.order == 5 && structure.metadata.has_wonder,
            "registered realm metadata changed",
        );
        assert!(
            structure
                .resources_packed == crate::models::structure::StructureResourcesImpl::pack_resource_types([2].span()),
            "registered production traits changed",
        );
    }

    #[test]
    #[should_panic(expected: "Eternum: Player is already settled")]
    fn eternum_paid_owner_cannot_reuse_entitlement_from_another_account() {
        let (mut context, season) = setup_eternum_game();
        bind_eternum_entry_owner(ref context, true);
        start_cheat_block_timestamp_global(250);
        season.settle(GAME_A, 'first-account');
        start_cheat_caller_address(season.contract_address, 'another-account'.try_into().unwrap());
        season.settle(GAME_A, 'second-account');
    }

    #[test]
    #[should_panic(expected: "Eternum: Player is already settled")]
    fn eternum_open_owner_cannot_reenter_through_another_bound_account() {
        let (mut context, season) = setup_eternum_game();
        bind_eternum_entry_owner(ref context, false);
        start_cheat_block_timestamp_global(250);
        season.settle(GAME_A, 'first-account');
        start_cheat_caller_address(season.contract_address, 'another-account'.try_into().unwrap());
        season.settle(GAME_A, 'second-account');
    }

    #[test]
    #[should_panic(expected: "Eternum: Player is already settled")]
    fn blitz_paid_owner_cannot_settle_through_two_accounts() {
        let mut context = setup_dev_off_game('operator'.try_into().unwrap());
        bind_eternum_entry_owner(ref context, true);
        let mut registration: BlitzRegistrationGameConfig = WorldConfigUtilImpl::get_member(
            context.world, GAME_A, selector!("blitz_registration_config"),
        );
        registration.registration_count_max = 2;
        WorldConfigUtilImpl::set_member(
            ref context.world, GAME_A, selector!("blitz_registration_config"), registration,
        );
        settle_inside_registration_window(@context);
        start_cheat_caller_address(context.blitz.contract_address, 'another-account'.try_into().unwrap());
        context.blitz.settle(GAME_A, 'second-account', [].span(), false);
    }

    #[test]
    fn season_game_creation_populates_both_spire_layers_before_settling() {
        start_cheat_block_timestamp_global(1);
        let (mut context, _) = setup_eternum_game();
        let center = crate::models::position::CoordImpl::center(ref context.world, GAME_A);
        assert_spire_pair(context.world, center.x, center.y);
        let config: SettlementConfig = WorldConfigUtilImpl::get_member(
            context.world, GAME_A, selector!("settlement_config"),
        );
        assert!(config.spires_settled_count == 1, "preset spire count was not initialized");
    }

    #[test]
    fn season_game_creation_fills_the_spire_lattice() {
        let (mut context, _) = setup_eternum_game_with_spires(9);
        let center = crate::models::position::CoordImpl::center(ref context.world, GAME_A);
        assert_spire_pair(context.world, center.x, center.y);
        for direction in DirectionTrait::all() {
            let coord = center.neighbor_after_distance(direction, 15);
            assert_spire_pair(context.world, coord.x, coord.y);
        }
        assert_spire_pair(context.world, center.x + 30, center.y);
        let config: SettlementConfig = WorldConfigUtilImpl::get_member(
            context.world, GAME_A, selector!("settlement_config"),
        );
        assert!(config.spires_settled_count == 9, "wrong spire count");
        let second_ring_side = crate::models::config::SettlementConfigImpl::generate_coord(
            config, true, 1, 2, 0, center,
        );
        assert_spire_pair(context.world, second_ring_side.x, second_ring_side.y);
        let beyond: TileOpt = context.world.read_model((GAME_A, false, center.x + 45, center.y));
        assert!(beyond.data == 0, "created outside preset count");
    }

    #[test]
    fn seven_portals_connect_each_ring_access_in_four_ethereal_steps() {
        let (mut context, _) = setup_eternum_game_with_spire_spacing(7, 60);
        let center = crate::models::position::CoordImpl::center(ref context.world, GAME_A);
        for direction in DirectionTrait::all() {
            let portal = center.neighbor_after_distance(direction, 60);
            assert_spire_pair(context.world, portal.x, portal.y);
            let mut access = center.neighbor(crate::models::position::Direction::West);
            access.alt = true;
            for _ in 0_u8..4 {
                access = access.neighbor(direction);
            }
            let destination_portal = access.spire_neighbor(crate::models::position::Direction::East);
            assert_eq!(destination_portal.x, portal.x);
            assert_eq!(destination_portal.y, portal.y);
        }
    }

    #[test]
    #[should_panic(expected: "Eternum: spire spacing must align with ethereal steps")]
    fn season_game_rejects_a_disconnected_portal_lattice() {
        setup_eternum_game_with_spire_spacing(7, 48);
    }

    #[test]
    #[should_panic(expected: "Eternum: season preset requires a spire")]
    fn season_game_creation_rejects_a_preset_without_spires() {
        setup_eternum_game_with_spires(0);
    }

    #[test]
    #[should_panic(expected: "Eternum: spire count exceeds lattice")]
    fn season_game_creation_rejects_more_spires_than_the_lattice_holds() {
        setup_eternum_game_with_spires(20);
    }

    #[test]
    fn blitz_game_creation_leaves_the_alternate_layer_empty() {
        let mut context = setup_dev_off_game('operator'.try_into().unwrap());
        let center = crate::models::position::CoordImpl::center(ref context.world, GAME_A);
        let tile: TileOpt = context.world.read_model((GAME_A, true, center.x, center.y));
        assert!(tile.data == 0, "Blitz created an alternate tile");
        let config: SettlementConfig = WorldConfigUtilImpl::get_member(
            context.world, GAME_A, selector!("settlement_config"),
        );
        assert!(config.spires_settled_count == 0, "Blitz created spires");
    }

    fn assert_spire_pair(world: WorldStorage, x: u32, y: u32) {
        let surface: TileOpt = world.read_model((GAME_A, false, x, y));
        let alternate: TileOpt = world.read_model((GAME_A, true, x, y));
        let surface: crate::models::map::Tile = surface.into();
        let alternate: crate::models::map::Tile = alternate.into();
        assert!(surface.occupier_type == crate::models::map::TileOccupier::Spire.into(), "surface spire missing");
        assert!(alternate.occupier_type == surface.occupier_type, "alternate spire missing");
        assert!(surface.occupier_id != 0 && surface.occupier_id == alternate.occupier_id, "spire identity differs");
        assert!(surface.biome != 0 && alternate.biome != 0, "spire tiles are undiscovered");
        let structure: crate::models::structure::Structure = world.read_model((GAME_A, surface.occupier_id));
        assert!(structure.owner.is_zero(), "portal has an owner");
        assert!(structure.base.troop_guard_count == 0, "portal has guards");
    }

    #[test]
    fn open_entry_never_reuses_a_canonical_realm() {
        let (mut context, season) = setup_eternum_game();
        start_cheat_block_timestamp_global(250);
        let tx_hash = starknet::get_tx_info().unbox().transaction_hash;
        context.world.write_model_test(@crate::models::rng::RNG { tx_hash, seed: 42 });
        let first_id = season.settle(GAME_A, 'first');
        context.world.write_model_test(@crate::models::rng::RNG { tx_hash, seed: 42 });
        start_cheat_caller_address(season.contract_address, 'another-account'.try_into().unwrap());
        let second_id = season.settle(GAME_A, 'second');
        let first: crate::models::structure::Structure = context.world.read_model((GAME_A, first_id));
        let second: crate::models::structure::Structure = context.world.read_model((GAME_A, second_id));
        assert!(first.metadata.realm_id != second.metadata.realm_id, "canonical realm allocated twice");
    }

    #[test]
    #[should_panic(expected: "Eternum: checkpoint shares before ranking")]
    fn ranking_requires_completed_share_checkpoints() {
        let mut context = setup_lifecycle();
        let mut game = GameRegistryImpl::get(context.world, GAME_A);
        game.dev_mode_on = false;
        game.end_at = 200;
        context.world.write_model_test(@game);
        let mut registration: BlitzRegistrationGameConfig = WorldConfigUtilImpl::get_member(
            context.world, GAME_A, selector!("blitz_registration_config"),
        );
        registration.registration_count = 2;
        WorldConfigUtilImpl::set_member(
            ref context.world, GAME_A, selector!("blitz_registration_config"), registration,
        );
        seed_completed_shares(ref context.world, GAME_A, context.player, 123.try_into().unwrap());
        start_cheat_block_timestamp_global(201);
        context.registrar.rank_players(GAME_A, 88, 2, array![context.player]);
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
        context.registrar.rank_players(GAME_A, 88, 1, array![attacker]);
    }

    #[test]
    #[should_panic(expected: "Eternum: caller is not the registrar")]
    fn player_cannot_start_or_squat_a_ranking_trial() {
        let context = setup_lifecycle();
        prize_dispatcher(context.world).blitz_prize_player_rank(GAME_A, 88, 1, array![context.player]);
    }

    #[test]
    #[should_panic(expected: "Eternum: caller is not admin")]
    fn player_cannot_forward_ranking_through_registrar() {
        let context = setup_lifecycle();
        start_cheat_caller_address(context.registrar.contract_address, 'attacker'.try_into().unwrap());
        context.registrar.rank_players(GAME_A, 88, 1, array![context.player]);
    }

    #[test]
    #[should_panic(expected: "Eternum: checkpoint range leaves a gap")]
    fn checkpoint_cannot_skip_unsettled_hyperstructures() {
        let mut context = setup_lifecycle();
        let mut game = GameRegistryImpl::get(context.world, GAME_A);
        game.dev_mode_on = false;
        context.world.write_model_test(@game);
        seed_completed_shares(ref context.world, GAME_A, context.player, 123.try_into().unwrap());
        start_cheat_block_timestamp_global(301);
        context.registrar.checkpoint_share_points(GAME_A, 1, 1);
    }

    #[test]
    #[should_panic(expected: "Eternum: invalid checkpoint range")]
    fn checkpoint_rejects_more_than_sixteen_hyperstructures() {
        let mut context = setup_lifecycle();
        let mut game = GameRegistryImpl::get(context.world, GAME_A);
        game.dev_mode_on = false;
        context.world.write_model_test(@game);
        context
            .world
            .write_model_test(
                @crate::models::hyperstructure::HyperstructureGlobals {
                    game_id: GAME_A, created_count: 17, completed_count: 17,
                },
            );
        start_cheat_block_timestamp_global(301);
        context.registrar.checkpoint_share_points(GAME_A, 0, 17);
    }

    fn seed_completed_shares(ref world: WorldStorage, game_id: u32, first: ContractAddress, second: ContractAddress) {
        WorldConfigUtilImpl::set_member(
            ref world,
            TEST_PRESET_ID,
            selector!("victory_points_grant_config"),
            VictoryPointsGrantConfig {
                hyp_points_per_second: 5_000_000,
                claim_hyperstructure_points: 0,
                claim_otherstructure_points: 0,
                explore_tiles_points: 0,
                relic_open_points: 0,
            },
        );
        for hyperstructure_id in 700..702_u32 {
            world
                .write_model_test(
                    @Hyperstructure {
                        game_id,
                        hyperstructure_id,
                        initialized: true,
                        completed: true,
                        access: Default::default(),
                        randomness: 0,
                        points_multiplier: 1,
                    },
                );
            world
                .write_model_test(
                    @HyperstructureShareholders {
                        game_id, hyperstructure_id, start_at: 100, shareholders: [(first, 5000), (second, 5000)].span(),
                    },
                );
            CompletedHyperstructureImpl::record(ref world, game_id, hyperstructure_id);
        }
    }

    #[test]
    fn registrar_finalizes_all_shares_and_ties_independently_of_input_order() {
        let mut context = setup_lifecycle();
        let second: ContractAddress = 123.try_into().unwrap();
        let mut state = SeriesChestRewardStateImpl::new(SERIES_ID, 22, 10_000);
        state.game_index = 2;
        context.world.write_model_test(@state);
        for game_id in GAME_A..3_u32 {
            let mut game = GameRegistryImpl::get(context.world, game_id);
            game.dev_mode_on = false;
            game.end_at = 200;
            game.registration_grace_seconds = 9999;
            context.world.write_model_test(@game);
            let mut registration: BlitzRegistrationGameConfig = WorldConfigUtilImpl::get_member(
                context.world, game_id, selector!("blitz_registration_config"),
            );
            registration.registration_count = 2;
            WorldConfigUtilImpl::set_member(
                ref context.world, game_id, selector!("blitz_registration_config"), registration,
            );
            context
                .world
                .write_model_test(
                    @crate::models::config::BlitzSettlement { game_id, player: second, structure_ids: [1000].span() },
                );
            context.world.write_model_test(@GameChestReward { game_id, allocated_chests: 11, distributed_chests: 0 });
            seed_completed_shares(ref context.world, game_id, context.player, second);
        }
        start_cheat_block_timestamp_global(201);
        context.registrar.checkpoint_share_points(GAME_A, 0, 2);
        context.registrar.checkpoint_share_points(GAME_A, 0, 2);
        context.registrar.rank_players(GAME_A, 88, 2, array![context.player]);
        context.registrar.rank_players(GAME_A, 88, 2, array![second]);
        context.registrar.checkpoint_share_points(GAME_B, 0, 1);
        context.registrar.checkpoint_share_points(GAME_B, 1, 1);
        context.registrar.rank_players(GAME_B, 89, 2, array![second, context.player]);
        for game_id in GAME_A..3_u32 {
            let first_rank: PlayerRank = context.world.read_model((game_id, context.player));
            let second_rank: PlayerRank = context.world.read_model((game_id, second));
            let points: PlayerRegisteredPoints = context.world.read_model((game_id, context.player));
            let total: SeasonPrize = context.world.read_model(game_id);
            let chests: GameChestReward = context.world.read_model(game_id);
            assert!(first_rank.rank == 1 && second_rank.rank == 1, "tied ranks changed with ordering");
            assert!(first_rank.chests == 5 && second_rank.chests == 5, "tied chest entitlements changed with ordering");
            assert!(
                points.registered_points == 500_000_000 && total.total_registered_points == 1_000_000_000,
                "finalization did not checkpoint every share",
            );
            assert!(
                chests.allocated_chests == 11 && chests.distributed_chests == 10, "indivisible chest was allocated",
            );
            assert!(GameRegistryImpl::get(context.world, game_id).final_trial_id != 0, "ranking did not finalize");
        }
    }

    #[test]
    fn eternum_season_close_counts_unclaimed_shares_before_testing_victory() {
        let (mut context, _) = setup_eternum_game();
        WorldConfigUtilImpl::set_member(
            ref context.world,
            TEST_PRESET_ID,
            selector!("victory_points_win_config"),
            VictoryPointsWinConfig { points_for_win: 500_000_000 },
        );
        seed_completed_shares(ref context.world, GAME_A, context.player, 123.try_into().unwrap());
        start_cheat_block_timestamp_global(200);
        let (address, _) = context.world.dns(@"season_systems").unwrap();
        ISeasonSystemsDispatcher { contract_address: address }.season_close(GAME_A);
        let game = GameRegistryImpl::get(context.world, GAME_A);
        let total: SeasonPrize = context.world.read_model(GAME_A);
        assert!(game.status == GameStatus::Ended && game.end_at == 200, "season did not close at the winning cutoff");
        assert!(total.total_registered_points == 1_000_000_000, "other shareholder was not settled at the same cutoff");
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
            quest_config: crate::models::config::QuestConfig { quest_discovery_prob: 0, quest_discovery_fail_prob: 0 },
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
            spire_travel_essence_cost: 0,
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

#[cfg(test)]
#[starknet::contract]
mod SharedOwnerRegistryMock {
    #[storage]
    struct Storage {}
    #[abi(embed_v0)]
    impl Registry of crate::models::ledger::IPlayerRegistry<ContractState> {
        fn owner_of(self: @ContractState, account: starknet::ContractAddress) -> starknet::ContractAddress {
            123.try_into().unwrap()
        }
    }
}
