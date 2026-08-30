use crate::models::config::{
    BuildingCategoryConfig, ChainConfig, HyperstrtConstructConfig, MapConfig, PresetConfig, PresetGameConfig,
    ResourceFactoryConfig, StructureLevelConfig, WeightConfig,
};
use crate::models::resource::resource::{ResourceList, ResourceMinMaxList};


#[derive(Drop, Serde)]
pub struct PresetSideTables {
    pub weights: Span<WeightConfig>,
    pub resource_factories: Span<ResourceFactoryConfig>,
    pub building_categories: Span<BuildingCategoryConfig>,
    pub structure_levels: Span<StructureLevelConfig>,
    pub hyperstructure_construction: Span<HyperstrtConstructConfig>,
    pub resource_lists: Span<ResourceList>,
    pub resource_min_max_lists: Span<ResourceMinMaxList>,
}


#[derive(Copy, Drop, Serde)]
pub struct CreateGameParams {
    pub name: felt252,
    pub preset_id: u32,
    pub series_id: felt252,
    pub game_number_in_series: u16,
    pub start_settling_at: u64,
    pub start_main_at: u64,
    pub duration_seconds: u64,
    pub end_grace_seconds: u32,
    pub registration_grace_seconds: u32,
    pub dev_mode_on: bool,
    pub single_realm_mode: bool,
    pub two_player_mode: bool,
    pub registration_count_max: u16,
    pub registration_start_at: u32,
    pub biome_climate_config: crate::models::config::BiomeClimateConfig,
    pub use_map_override: bool,
    pub map_override: MapConfig,
    pub seed: felt252,
}


#[starknet::interface]
pub trait IRegistrarSystems<T> {
    fn bootstrap_chain_config(ref self: T, chain_config: ChainConfig);
    fn register_preset(
        ref self: T, preset_config: PresetConfig, game_config: PresetGameConfig, side_tables: PresetSideTables,
    );
    fn register_series(
        ref self: T,
        series_id: felt252,
        owner: starknet::ContractAddress,
        num_games: u32,
        total_chests: u128,
        cap_ratio_bps: u128,
    );
    fn create_game(ref self: T, params: CreateGameParams) -> u32;
    fn sync_game_status(ref self: T, game_id: u32);
    fn reset_trial(ref self: T, game_id: u32);
    fn mark_game_settled(ref self: T, game_id: u32);
}


#[starknet::interface]
trait IPrizeLifecycle<T> {
    fn reset_trial(ref self: T, game_id: u32);
}


#[starknet::interface]
trait IHyperstructureReservation<T> {
    fn reserve_hyperstructures(ref self: T, game_id: u32, count: u8);
}


#[dojo::contract]
pub mod registrar_systems {
    use core::num::traits::zero::Zero;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
    use starknet::ContractAddress;
    use crate::constants::{DAYDREAMS_AGENT_ID, DEFAULT_NS, WORLD_CONFIG_ID, assert_blitz_registration_count_within_cap};
    use crate::models::agent::AgentConfig;
    use crate::models::config::{
        BlitzHypersSettlementConfigImpl, ChainConfig, GameMapConfig, MapConfig, PresetConfig, PresetGameConfig,
        RealmCountConfig, WorldConfig,
    };
    use crate::models::game::{GAME_COUNTER_ID, GameCounter, GameRegistry, GameRegistryImpl, GameStatus, Preset, Series};
    use crate::models::position::CENTER_COL;
    use crate::models::quest::{QuestFeatureFlag, QuestGameRegistry, QuestLevels};
    use crate::systems::quest::constants::VERSION;
    use crate::systems::utils::blitz_profile::iBlitzProfileImpl;
    use super::{
        CreateGameParams, IHyperstructureReservationDispatcher, IHyperstructureReservationDispatcherTrait,
        IPrizeLifecycleDispatcher, IPrizeLifecycleDispatcherTrait, IRegistrarSystems, PresetSideTables,
    };


    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct GameCreated {
        #[key]
        pub game_id: u32,
        #[key]
        pub preset_id: u32,
        pub series_id: felt252,
        pub creator: ContractAddress,
        pub start_main_at: u64,
        pub end_at: u64,
    }


    #[abi(embed_v0)]
    pub impl RegistrarSystemsImpl of IRegistrarSystems<ContractState> {
        fn bootstrap_chain_config(ref self: ContractState, chain_config: ChainConfig) {
            let mut world = self.world(DEFAULT_NS());
            let caller = starknet::get_caller_address();
            assert!(
                world.dispatcher.is_owner(selector_from_tag!("s2-registrar_systems"), caller),
                "Eternum: caller is not the world owner",
            );
            let existing: ChainConfig = world.read_model(WORLD_CONFIG_ID);
            assert!(existing.admin_address.is_zero(), "Eternum: chain config already initialized");
            assert!(chain_config.admin_address.is_non_zero(), "Eternum: admin address is zero");
            assert!(caller == chain_config.admin_address, "Eternum: caller must be configured admin");

            let initialized = ChainConfig { config_id: WORLD_CONFIG_ID, ..chain_config };
            world.write_model(@initialized);
            world.write_model(@GameCounter { id: GAME_COUNTER_ID, next_game_id: 1 });
        }

        fn register_preset(
            ref self: ContractState,
            preset_config: PresetConfig,
            game_config: PresetGameConfig,
            side_tables: PresetSideTables,
        ) {
            let mut world = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);
            assert!(preset_config.preset_id.is_non_zero(), "Eternum: preset id 0 is reserved");
            assert!(preset_config.preset_id == game_config.preset_id, "Eternum: preset configuration ids do not match");

            let preset: Preset = world.read_model(preset_config.preset_id);
            assert!(!preset.registered, "Eternum: preset already registered");
            iBlitzProfileImpl::assert_known_blitz_profile_id(preset_config.blitz_exploration_config.reward_profile_id);

            world.write_model(@preset_config);
            world.write_model(@game_config);
            write_preset_side_tables(ref world, preset_config.preset_id, side_tables);
            world.write_model(@Preset { preset_id: preset_config.preset_id, registered: true });
        }

        fn register_series(
            ref self: ContractState,
            series_id: felt252,
            owner: ContractAddress,
            num_games: u32,
            total_chests: u128,
            cap_ratio_bps: u128,
        ) {
            let mut world = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);
            assert!(series_id.is_non_zero(), "Eternum: series id 0 is reserved");
            assert!(owner.is_non_zero(), "Eternum: series owner is zero");
            assert!(num_games.is_non_zero(), "Eternum: series must contain games");
            assert!(num_games <= 0xffff, "Eternum: too many games in series");
            assert!(cap_ratio_bps >= 10_000, "Eternum: invalid series chest cap");
            assert_series_chest_allocation_fits_u16(total_chests, cap_ratio_bps);

            let existing: Series = world.read_model(series_id);
            assert!(existing.owner.is_zero(), "Eternum: series already registered");
            world.write_model(@Series { series_id, owner, game_count: 0, num_games, total_chests, cap_ratio_bps });
        }

        fn create_game(ref self: ContractState, params: CreateGameParams) -> u32 {
            let mut world = self.world(DEFAULT_NS());
            let creator = starknet::get_caller_address();
            assert!(creator.is_non_zero(), "Eternum: creator address is zero");
            assert_uuid_headroom(ref world);

            let (preset_rules, preset_game_config) = validate_game_params(world, params);
            let game_id = assign_game_id(ref world);
            let registry = build_game_registry(game_id, creator, params);
            let world_config = build_world_config(game_id, params, preset_game_config);
            let map_config = resolve_game_map_config(game_id, params, preset_rules.map_config);
            let agent_config = build_agent_config(game_id, preset_game_config);

            update_series_for_new_game(ref world, params);
            world.write_model(@registry);
            world.write_model(@world_config);
            world.write_model(@map_config);
            world.write_model(@agent_config);
            initialize_quest_config(ref world, game_id, preset_rules);
            // Blitz pre-reserves its fixed hyperstructure sites at creation; eternum
            // hyperstructures are player-built and the reservation system is blitz-gated.
            if preset_game_config.blitz_mode_on {
                reserve_hyperstructures_for_game(ref world, game_id);
            }
            emit_game_created(ref world, registry);

            game_id
        }

        fn sync_game_status(ref self: ContractState, game_id: u32) {
            let mut world = self.world(DEFAULT_NS());
            let mut game = GameRegistryImpl::get(world, game_id);
            game.status = resolve_game_status(game);
            world.write_model(@game);
        }

        fn reset_trial(ref self: ContractState, game_id: u32) {
            let world = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);
            prize_lifecycle_dispatcher(world).reset_trial(game_id);
        }

        fn mark_game_settled(ref self: ContractState, game_id: u32) {
            let mut world = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);
            let mut game = GameRegistryImpl::get(world, game_id);
            assert!(resolve_game_status(game) == GameStatus::Ended, "Eternum: game has not ended");
            assert!(
                starknet::get_block_timestamp() > game.end_at + game.end_grace_seconds.into(),
                "Eternum: game settlement grace period is active",
            );
            game.status = GameStatus::Settled;
            world.write_model(@game);
        }
    }


    fn assert_caller_is_admin(world: WorldStorage) {
        let chain_config: ChainConfig = world.read_model(WORLD_CONFIG_ID);
        assert!(chain_config.admin_address.is_non_zero(), "Eternum: registrar is not initialized");
        assert!(starknet::get_caller_address() == chain_config.admin_address, "Eternum: caller is not admin");
    }

    fn assert_uuid_headroom(ref world: WorldStorage) {
        let current_uuid = world.dispatcher.uuid();
        assert!(current_uuid < DAYDREAMS_AGENT_ID - 1, "Eternum: reserved id headroom exhausted");
    }

    fn assert_series_chest_allocation_fits_u16(total_chests: u128, cap_ratio_bps: u128) {
        if total_chests.is_zero() {
            return;
        }
        let max_cap_ratio_bps = (0xffff_u128 * 10_000) / total_chests;
        assert!(cap_ratio_bps <= max_cap_ratio_bps, "Eternum: series chest allocation exceeds u16");
    }

    fn prize_lifecycle_dispatcher(world: WorldStorage) -> IPrizeLifecycleDispatcher {
        let (prize_distribution, _) = world.dns(@"prize_distribution_systems").expect('prize system not found');
        IPrizeLifecycleDispatcher { contract_address: prize_distribution }
    }

    fn write_preset_side_tables(ref world: WorldStorage, preset_id: u32, side_tables: PresetSideTables) {
        for row in side_tables.weights {
            let mut row = *row;
            row.preset_id = preset_id;
            world.write_model(@row);
        }
        for row in side_tables.resource_factories {
            let mut row = *row;
            row.preset_id = preset_id;
            world.write_model(@row);
        }
        for row in side_tables.building_categories {
            let mut row = *row;
            row.preset_id = preset_id;
            world.write_model(@row);
        }
        for row in side_tables.structure_levels {
            let mut row = *row;
            row.preset_id = preset_id;
            world.write_model(@row);
        }
        for row in side_tables.hyperstructure_construction {
            let mut row = *row;
            row.preset_id = preset_id;
            world.write_model(@row);
        }
        for row in side_tables.resource_lists {
            let mut row = *row;
            row.preset_id = preset_id;
            world.write_model(@row);
        }
        for row in side_tables.resource_min_max_lists {
            let mut row = *row;
            row.preset_id = preset_id;
            world.write_model(@row);
        }
    }

    fn validate_game_params(world: WorldStorage, params: CreateGameParams) -> (PresetConfig, PresetGameConfig) {
        let registration_start_at: u64 = params.registration_start_at.into();
        assert!(params.name.is_non_zero(), "Eternum: game name is empty");
        assert!(params.seed.is_non_zero(), "Eternum: game seed is zero");
        assert!(params.duration_seconds.is_non_zero(), "Eternum: game duration is zero");
        assert!(params.start_settling_at <= params.start_main_at, "Eternum: invalid game schedule");
        assert!(registration_start_at < params.start_settling_at, "Eternum: registration must open before settling");
        assert!(!(params.single_realm_mode && params.two_player_mode), "Eternum: incompatible game modes");
        let preset: Preset = world.read_model(params.preset_id);
        assert!(preset.registered, "Eternum: preset is not registered");
        let preset_rules: PresetConfig = world.read_model(params.preset_id);
        let preset_game_config: PresetGameConfig = world.read_model(params.preset_id);
        validate_registration_capacity(params, preset_game_config.blitz_mode_on);
        validate_series_game(world, params);
        (preset_rules, preset_game_config)
    }

    fn validate_registration_capacity(params: CreateGameParams, blitz_mode_on: bool) {
        if !blitz_mode_on {
            assert!(params.registration_count_max == 0, "Eternum: season presets do not use blitz registration");
            return;
        }
        assert!(params.registration_count_max.is_non_zero(), "Eternum: registration capacity is zero");
        assert_blitz_registration_count_within_cap(params.registration_count_max);
        if params.two_player_mode {
            assert!(params.registration_count_max == 2, "Eternum: two-player games require two registrations");
        }
    }

    fn validate_series_game(world: WorldStorage, params: CreateGameParams) {
        if params.series_id.is_zero() {
            assert!(params.game_number_in_series == 0, "Eternum: standalone game has a series number");
            return;
        }

        let series: Series = world.read_model(params.series_id);
        assert!(series.owner.is_non_zero(), "Eternum: series is not registered");
        assert!(starknet::get_caller_address() == series.owner, "Eternum: caller is not series owner");
        assert!(series.game_count.into() < series.num_games, "Eternum: series is full");
        assert!(
            params.game_number_in_series == series.game_count + 1, "Eternum: series games must be created in order",
        );
    }

    fn assign_game_id(ref world: WorldStorage) -> u32 {
        let mut counter: GameCounter = world.read_model(GAME_COUNTER_ID);
        assert!(counter.next_game_id.is_non_zero(), "Eternum: registrar is not initialized");
        assert!(counter.next_game_id < DAYDREAMS_AGENT_ID, "Eternum: reserved id headroom exhausted");
        let game_id = counter.next_game_id;
        counter.next_game_id += 1;
        world.write_model(@counter);
        game_id
    }

    fn build_game_registry(game_id: u32, creator: ContractAddress, params: CreateGameParams) -> GameRegistry {
        let end_at = params.start_main_at + params.duration_seconds;
        GameRegistry {
            game_id,
            name: params.name,
            series_id: params.series_id,
            game_number_in_series: params.game_number_in_series,
            preset_id: params.preset_id,
            creator,
            status: initial_game_status(params),
            dev_mode_on: params.dev_mode_on,
            start_settling_at: params.start_settling_at,
            start_main_at: params.start_main_at,
            end_at,
            end_grace_seconds: params.end_grace_seconds,
            registration_grace_seconds: params.registration_grace_seconds,
            final_trial_id: 0,
            seed: params.seed,
        }
    }

    fn build_world_config(game_id: u32, params: CreateGameParams, preset: PresetGameConfig) -> WorldConfig {
        let mut settlement = preset.settlement_config;
        settlement.spires_settled_count = 0;
        let mut blitz_settlement = preset.blitz_settlement_config;
        blitz_settlement.side = 0;
        blitz_settlement.step = 1;
        blitz_settlement.point = 1;
        blitz_settlement.open_settlement_count = 0;
        blitz_settlement.single_realm_mode = params.single_realm_mode;
        blitz_settlement.two_player_mode = params.two_player_mode;

        let mut registration = preset.blitz_registration_config;
        registration.registration_count = 0;
        registration.registration_count_max = params.registration_count_max;
        registration.registration_start_at = params.registration_start_at;

        WorldConfig {
            game_id,
            map_center_offset: derive_map_center_offset(game_id, params.seed),
            biome_climate_config: params.biome_climate_config,
            settlement_config: settlement,
            blitz_mode_on: preset.blitz_mode_on,
            blitz_settlement_config: blitz_settlement,
            blitz_hypers_settlement_config: BlitzHypersSettlementConfigImpl::new(),
            blitz_registration_config: registration,
            realm_count_config: RealmCountConfig { count: 0 },
        }
    }

    fn resolve_game_map_config(game_id: u32, params: CreateGameParams, preset_map: MapConfig) -> GameMapConfig {
        let map_config = if params.use_map_override {
            params.map_override
        } else {
            preset_map
        };
        GameMapConfig { game_id, map_config }
    }

    fn build_agent_config(game_id: u32, preset: PresetGameConfig) -> AgentConfig {
        AgentConfig {
            game_id,
            max_lifetime_count: preset.agent_max_lifetime_count,
            max_current_count: preset.agent_max_current_count,
            min_spawn_lords_amount: preset.agent_min_spawn_lords_amount,
            max_spawn_lords_amount: preset.agent_max_spawn_lords_amount,
        }
    }

    fn initialize_quest_config(ref world: WorldStorage, game_id: u32, preset: PresetConfig) {
        let mut game_addresses = array![];
        for quest_game in preset.quest_games {
            let quest_game = *quest_game;
            game_addresses.append(quest_game.address);
            world.write_model(@QuestLevels { game_id, game_address: quest_game.address, levels: quest_game.levels });
        }
        world.write_model(@QuestGameRegistry { game_id, key: VERSION, games: game_addresses.span() });
        world.write_model(@QuestFeatureFlag { game_id, key: VERSION, enabled: true });
    }

    fn update_series_for_new_game(ref world: WorldStorage, params: CreateGameParams) {
        if params.series_id.is_zero() {
            return;
        }
        let mut series: Series = world.read_model(params.series_id);
        series.game_count += 1;
        world.write_model(@series);
    }

    fn reserve_hyperstructures_for_game(ref world: WorldStorage, game_id: u32) {
        let (reservation_system, _) = world
            .dns(@"hyperstructure_create_systems")
            .expect('reservation system not found');
        IHyperstructureReservationDispatcher { contract_address: reservation_system }
            .reserve_hyperstructures(game_id, 0xff);
    }

    fn derive_map_center_offset(game_id: u32, seed: felt252) -> u32 {
        let seed_value: u256 = seed.into();
        let offset_step_count = (CENTER_COL / 2) / 10;
        let seed_step: u32 = (seed_value % offset_step_count.into()).try_into().unwrap();
        let game_step = game_id % offset_step_count;
        ((seed_step + game_step) % offset_step_count) * 10
    }

    fn initial_game_status(params: CreateGameParams) -> GameStatus {
        if params.dev_mode_on || starknet::get_block_timestamp() >= params.start_main_at {
            GameStatus::Live
        } else {
            GameStatus::Registration
        }
    }

    fn resolve_game_status(game: GameRegistry) -> GameStatus {
        if game.status == GameStatus::Settled {
            return GameStatus::Settled;
        }
        let now = starknet::get_block_timestamp();
        if now >= game.end_at {
            return GameStatus::Ended;
        }
        if game.dev_mode_on || now >= game.start_main_at {
            return GameStatus::Live;
        }
        GameStatus::Registration
    }

    fn emit_game_created(ref world: WorldStorage, game: GameRegistry) {
        world
            .emit_event(
                @GameCreated {
                    game_id: game.game_id,
                    preset_id: game.preset_id,
                    series_id: game.series_id,
                    creator: game.creator,
                    start_main_at: game.start_main_at,
                    end_at: game.end_at,
                },
            );
    }

    pub fn get_dispatcher(world: @WorldStorage) -> super::IRegistrarSystemsDispatcher {
        let (address, _) = world.dns(@"registrar_systems").expect('registrar not found');
        super::IRegistrarSystemsDispatcher { contract_address: address }
    }
}
