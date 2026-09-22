use starknet::ContractAddress;
use crate::presets::PresetDefinition;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct CreateGameParams {
    pub name: felt252,
    pub preset_id: u32,
    pub start_settling_at: u64,
    pub start_main_at: u64,
    pub duration_seconds: u64,
    pub end_grace_seconds: u32,
    pub dev_mode_on: bool,
    pub mode: crate::settlement::SettlementMode,
    pub roster: Span<RosterPlayer>,
    pub registration_start: u32,
    pub biome_climate: crate::rules::BiomeClimateConfig,
    pub map_override: Option<crate::rules::MapConfig>,
    pub seed: felt252,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct RosterPlayer {
    pub owner: ContractAddress,
    pub account: ContractAddress,
}

#[starknet::interface]
pub trait IRegistrar<T> {
    fn register_preset(ref self: T, preset_id: u32, definition: PresetDefinition);
    fn preset_commitment(self: @T, preset_id: u32) -> felt252;
    fn next_game_id(self: @T) -> u32;
    fn game_id_by_name(self: @T, name: felt252) -> u32;
    fn blitz_roster(self: @T, game_id: u32) -> Span<RosterPlayer>;
    fn create_game(ref self: T, params: CreateGameParams, definition: PresetDefinition) -> u32;
}
#[starknet::interface]
pub trait IGameSettlement<T> {
    fn mark_game_settled(
        ref self: T, game_id: u32, actor: ContractAddress, context: crate::commands::ExecutionContext,
    ) -> u64;
}

pub fn validate_params(params: CreateGameParams, rules: crate::rules::SliceRules, spacing: u32) {
    assert!(params.name != 0, "game name is empty");
    assert!(params.seed != 0, "game seed is zero");
    assert!(params.duration_seconds != 0, "game duration is zero");
    crate::expeditions::validate_game(rules.epoch_seconds, spacing, params.duration_seconds);
    assert!(params.start_settling_at <= params.start_main_at, "invalid game schedule");
    assert!(
        Into::<u32, u64>::into(params.registration_start) < params.start_settling_at,
        "registration must open before settling",
    );
    if !crate::rules::rule_enabled(rules, crate::rules::SEASON_CLOSE) {
        assert!(params.end_grace_seconds == 0, "result finalisation has no grace period");
    }
    if rules.entry_rule == crate::rules::ENTRY_ROSTER {
        assert!(params.roster.len() > 0 && params.roster.len() <= 24, "invalid Blitz roster size");
        assert!(params.mode == crate::settlement::SettlementMode::Triple, "Regular Blitz required");
        assert!(!params.dev_mode_on, "free Blitz does not use development mode");
    } else {
        assert!(params.roster.is_empty(), "Eternum does not use a fixed roster");
        assert!(params.mode != crate::settlement::SettlementMode::Duel, "Eternum does not use Duel settlement");
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
        preset_id: params.preset_id,
        creator,
        settled: false,
        ready: params.roster.is_empty(),
        dev_mode_on: params.dev_mode_on,
        start_settling_at: params.start_settling_at,
        start_main_at: params.start_main_at,
        end_at: params.start_main_at + params.duration_seconds,
        end_grace_seconds: params.end_grace_seconds,
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
    use starknet::{get_caller_address, get_contract_address};
    use crate::events::RowSet;
    use crate::game::{IGameDispatcher, IGameDispatcherTrait};
    use crate::lifecycle::Lifecycle;
    use crate::lifecycle::Lifecycle::InternalTrait as LifeInternal;
    use crate::presets::PresetDefinition;
    use super::{CreateGameParams, RosterPlayer, build_game, game_rules};
    #[storage]
    pub struct Storage {
        pub presets: Map<u32, felt252>,
        pub next_game: u32,
        pub launch_ids: Map<felt252, u32>,
        pub launch_commitments: Map<felt252, felt252>,
        pub roster_sizes: Map<u32, u32>,
        pub roster_players: Map<(u32, u32), RosterPlayer>,
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
            crate::settlement_grid::validate_spacing(definition.settlement.spacing);
            if crate::rules::rule_enabled(definition.rules, crate::rules::SPIRES) {
                crate::spires::validate(definition.settlement.spires.expect('missing season spires'));
            } else {
                assert!(definition.settlement.spires.is_none(), "spires are disabled");
            }
            crate::presets::validate(definition);
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
        fn next_game_id(self: @ComponentState<TContractState>) -> u32 {
            self.next_game.read()
        }
        fn game_id_by_name(self: @ComponentState<TContractState>, name: felt252) -> u32 {
            self.launch_ids.read(name)
        }
        fn blitz_roster(self: @ComponentState<TContractState>, game_id: u32) -> Span<RosterPlayer> {
            let count = self.roster_sizes.read(game_id);
            assert!(count != 0, "game has no Blitz roster");
            let mut players = array![];
            for index in 0..count {
                players.append(self.roster_players.read((game_id, index)));
            }
            players.span()
        }
        fn create_game(
            ref self: ComponentState<TContractState>, params: CreateGameParams, definition: PresetDefinition,
        ) -> u32 {
            get_dep_component!(@self, Life).assert_authority();
            let peers = get_dep_component!(@self, Life).require_active();
            self.validate_game(params, definition);
            let mut encoded = array![];
            params.serialize(ref encoded);
            let commitment = core::poseidon::poseidon_hash_span(encoded.span());
            let previous = self.launch_ids.read(params.name);
            if previous != 0 {
                assert!(self.launch_commitments.read(params.name) == commitment, "conflicting game launch");
                return previous;
            }
            let game_id = self.next_game.read();
            assert!(game_id != 0 && game_id < 0xffffffff, "game identity space exhausted");
            self.register_roster(game_id, params.roster);
            let game = build_game(params, get_caller_address());
            let rules = game_rules(game_id, params, definition.rules);
            IGameDispatcher { contract_address: peers.registry }.initialize_game(game_id, game, rules);
            crate::presets::initialize_game(peers, game_id, definition, params);
            self.launch_ids.write(params.name, game_id);
            self.launch_commitments.write(params.name, commitment);
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
            super::validate_params(params, definition.rules, definition.settlement.spacing);
            let commitment = self.presets.read(params.preset_id);
            assert!(commitment != 0, "preset is not registered");
            assert!(commitment == crate::presets::commitment(definition), "preset definition mismatch");
        }
        fn register_roster(ref self: ComponentState<TContractState>, game_id: u32, players: Span<RosterPlayer>) {
            if players.is_empty() {
                return;
            }
            let season = crate::season::ISeasonDispatcher {
                contract_address: get_dep_component!(@self, Life).require_active().season,
            };
            let registry = crate::season::IPlayerRegistryDispatcher {
                contract_address: crate::season::ISeasonDispatcherTrait::authentication(season).registry,
            };
            let mut owners: core::dict::Felt252Dict<bool> = Default::default();
            let mut accounts: core::dict::Felt252Dict<bool> = Default::default();
            for index in 0..players.len() {
                let player = *players.at(index);
                assert!(
                    player.owner != 0.try_into().unwrap() && player.account != 0.try_into().unwrap(),
                    "unbound roster player",
                );
                assert!(
                    !owners.get(player.owner.into()) && !accounts.get(player.account.into()), "duplicate roster player",
                );
                owners.insert(player.owner.into(), true);
                accounts.insert(player.account.into(), true);
                assert!(
                    crate::season::IPlayerRegistryDispatcherTrait::account_of(registry, player.owner) == player.account
                        && crate::season::IPlayerRegistryDispatcherTrait::owner_of(registry, player.account) == player
                            .owner,
                    "roster binding mismatch",
                );
                self.roster_players.write((game_id, index), player);
            }
            self.roster_sizes.write(game_id, players.len());
            let mut values = array![];
            players.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1, model: 'BlitzRoster', keys: array![game_id.into()].span(), values: values.span(),
                    },
                );
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
