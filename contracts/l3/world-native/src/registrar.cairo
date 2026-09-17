use starknet::ContractAddress;
use crate::presets::PresetDefinition;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct CreateGameParams {
    pub name: felt252,
    pub preset_id: u32,
    pub series_id: felt252,
    pub game_number_in_series: u16,
    pub start_settling_at: u64,
    pub start_main_at: u64,
    pub duration_seconds: u64,
    pub end_grace_seconds: u32,
    pub dev_mode_on: bool,
    pub mode: crate::settlement::SettlementMode,
    pub registration_limit: u16,
    pub registration_start: u32,
    pub biome_climate: crate::rules::BiomeClimateConfig,
    pub map_override: Option<crate::rules::MapConfig>,
    pub seed: felt252,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct Series {
    pub owner: ContractAddress,
    pub created_games: u16,
}
#[starknet::interface]
pub trait IRegistrar<T> {
    fn register_preset(ref self: T, preset_id: u32, definition: PresetDefinition);
    fn preset_commitment(self: @T, preset_id: u32) -> felt252;
    fn register_series(
        ref self: T, series_id: felt252, owner: ContractAddress, rules: crate::series_chests::SeriesRules,
    );
    fn series(self: @T, series_id: felt252) -> Option<Series>;
    fn next_game_id(self: @T) -> u32;
    fn create_game(ref self: T, params: CreateGameParams, definition: PresetDefinition) -> u32;
}
#[starknet::interface]
pub trait IGameSettlement<T> {
    fn mark_game_settled(ref self: T, game_id: u32, actor: ContractAddress, context: crate::commands::ExecutionContext);
}

pub fn validate_params(params: CreateGameParams, blitz: bool) {
    assert!(params.name != 0, "game name is empty");
    assert!(params.seed != 0, "game seed is zero");
    assert!(params.duration_seconds != 0, "game duration is zero");
    assert!(params.start_settling_at <= params.start_main_at, "invalid game schedule");
    assert!(
        Into::<u32, u64>::into(params.registration_start) < params.start_settling_at,
        "registration must open before settling",
    );
    if blitz {
        assert!(
            params.registration_limit > 0 && params.registration_limit <= 96, "invalid Blitz registration capacity",
        );
        if params.mode == crate::settlement::SettlementMode::Duel {
            assert!(params.registration_limit == 2, "Duel requires two registrations");
        }
    } else {
        assert!(params.registration_limit == 0, "Eternum does not use Blitz registration capacity");
        assert!(params.mode != crate::settlement::SettlementMode::Duel, "Eternum does not use Duel settlement");
    }
    if params.series_id == 0 {
        assert!(params.game_number_in_series == 0, "standalone game has a series number");
    }
}
pub fn map_center_offset(game_id: u32, seed: felt252) -> u32 {
    const STEPS: u32 = (2147483646 / 2) / 10;
    let seed: u256 = seed.into();
    let seed_step: u32 = (seed % STEPS.into()).try_into().unwrap();
    ((seed_step + game_id % STEPS) % STEPS) * 10
}

fn build_game(params: CreateGameParams, creator: ContractAddress) -> crate::game::GameRegistry {
    crate::game::GameRegistry {
        name: params.name,
        series_id: params.series_id,
        game_number_in_series: params.game_number_in_series,
        preset_id: params.preset_id,
        creator,
        settled: false,
        dev_mode_on: params.dev_mode_on,
        start_settling_at: params.start_settling_at,
        start_main_at: params.start_main_at,
        end_at: params.start_main_at + params.duration_seconds,
        end_grace_seconds: params.end_grace_seconds,
        final_trial_id: 0,
        seed: params.seed,
    }
}
fn game_rules(game_id: u32, params: CreateGameParams, preset: crate::rules::SliceRules) -> crate::rules::SliceRules {
    crate::rules::SliceRules {
        biome_climate_config: params.biome_climate,
        map_config: params.map_override.unwrap_or(preset.map_config),
        map_center_offset: map_center_offset(game_id, params.seed),
        ..preset,
    }
}

#[starknet::component]
pub mod RegistrarState {
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use crate::blitz_prizes::{IBlitzPrizesDispatcher, IBlitzPrizesDispatcherTrait};
    use crate::events::RowSet;
    use crate::game::{IGameDispatcher, IGameDispatcherTrait};
    use crate::lifecycle::Lifecycle;
    use crate::lifecycle::Lifecycle::InternalTrait as LifeInternal;
    use crate::presets::PresetDefinition;
    use crate::series_chests::SeriesRules;
    use super::{CreateGameParams, Series, build_game, game_rules};
    #[storage]
    pub struct Storage {
        pub presets: Map<u32, felt252>,
        pub series: Map<felt252, Option<Series>>,
        pub next_game: u32,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
    }
    #[embeddable_as(RegistrarImpl)]
    pub impl Registrar<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: Lifecycle::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of super::IRegistrar<ComponentState<TContractState>> {
        fn register_preset(ref self: ComponentState<TContractState>, preset_id: u32, definition: PresetDefinition) {
            get_dep_component!(@self, Life).assert_authority();
            assert!(preset_id != 0, "preset id zero is reserved");
            assert!(self.presets.read(preset_id) == 0, "preset already registered");
            assert!(
                definition.settlement.reward_profile == 1 || definition.settlement.reward_profile == 2,
                "unknown settlement profile",
            );
            if definition.rules.blitz_mode_on {
                assert!(definition.settlement.spires.is_none(), "Blitz preset has spires");
            } else {
                crate::spires::validate(definition.settlement.spires.expect('missing season spires'));
                assert!(definition.economy.withdrawals.is_some(), "missing Eternum withdrawal configuration");
            }
            let commitment = crate::presets::commitment(definition);
            assert!(commitment != 0, "empty preset commitment");
            self.presets.write(preset_id, commitment);
            // Registration calldata retains the definition; launches supply its checked preimage.
            let values = array![commitment];
            self
                .emit(
                    RowSet {
                        version: 1, model: 'Preset', keys: array![preset_id.into()].span(), values: values.span(),
                    },
                );
        }
        fn preset_commitment(self: @ComponentState<TContractState>, preset_id: u32) -> felt252 {
            self.presets.read(preset_id)
        }
        fn register_series(
            ref self: ComponentState<TContractState>, series_id: felt252, owner: ContractAddress, rules: SeriesRules,
        ) {
            get_dep_component!(@self, Life).assert_authority();
            assert!(series_id != 0 && owner != 0.try_into().unwrap(), "invalid series identity");
            assert!(self.series.read(series_id).is_none(), "series already registered");
            IBlitzPrizesDispatcher { contract_address: get_dep_component!(@self, Life).require_active().prizes }
                .configure_series_chests(series_id, rules);
            self.write_series(series_id, Series { owner, created_games: 0 });
        }
        fn series(self: @ComponentState<TContractState>, series_id: felt252) -> Option<Series> {
            self.series.read(series_id)
        }
        fn next_game_id(self: @ComponentState<TContractState>) -> u32 {
            self.next_game.read()
        }
        fn create_game(
            ref self: ComponentState<TContractState>, params: CreateGameParams, definition: PresetDefinition,
        ) -> u32 {
            get_dep_component!(@self, Life).assert_authority();
            let peers = get_dep_component!(@self, Life).require_active();
            self.validate_game(params, definition);
            let game_id = self.next_game.read();
            assert!(game_id != 0 && game_id < crate::troops::AGENT_HOME, "game identity space exhausted");
            self.reserve_series(params);
            let game = build_game(params, get_caller_address());
            let rules = game_rules(game_id, params, definition.rules);
            IGameDispatcher { contract_address: peers.season }.create_game(game_id, game, rules);
            crate::presets::initialize_game(peers, game_id, definition, params);
            self.write_next_game(game_id + 1);
            game_id
        }
    }
    #[generate_trait]
    pub impl InternalImpl<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: Lifecycle::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of InternalTrait<TContractState> {
        fn initialize(ref self: ComponentState<TContractState>) {
            assert!(self.next_game.read() == 0, "registrar already initialized");
            self.write_next_game(1);
        }
        fn validate_game(
            self: @ComponentState<TContractState>, params: CreateGameParams, definition: PresetDefinition,
        ) {
            super::validate_params(params, definition.rules.blitz_mode_on);
            let commitment = self.presets.read(params.preset_id);
            assert!(commitment != 0, "preset is not registered");
            assert!(commitment == crate::presets::commitment(definition), "preset definition mismatch");
        }
        fn reserve_series(ref self: ComponentState<TContractState>, params: CreateGameParams) {
            if params.series_id == 0 {
                return;
            }
            let mut series = self.series.read(params.series_id).expect('series not registered');
            let rules = IBlitzPrizesDispatcher {
                contract_address: get_dep_component!(@self, Life).require_active().prizes,
            }
                .series_chest_rules(params.series_id);
            assert!(Into::<u16, u32>::into(series.created_games) < rules.num_games, "series is full");
            assert!(params.game_number_in_series == series.created_games + 1, "series games must be created in order");
            series.created_games += 1;
            self.write_series(params.series_id, series);
        }
        fn write_series(ref self: ComponentState<TContractState>, series_id: felt252, value: Series) {
            self.series.write(series_id, Some(value));
            let mut values = array![];
            value.serialize(ref values);
            self.emit(RowSet { version: 1, model: 'Series', keys: array![series_id].span(), values: values.span() });
        }
        fn write_next_game(ref self: ComponentState<TContractState>, next: u32) {
            self.next_game.write(next);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'GameSequence',
                        keys: array![get_contract_address().into()].span(),
                        values: array![next.into()].span(),
                    },
                );
        }
    }
}
