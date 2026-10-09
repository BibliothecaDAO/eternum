use starknet::storage::StorageMapReadAccess;
use crate::registrar::*;

pub fn blitz_roster(game_id: u32) -> Span<RosterPlayer> {
    let count = crate::state::read().registrar.roster_sizes.read(game_id);
    assert!(count != 0, "game has no Blitz roster");
    let mut players = array![];
    for index in 0..count {
        players.append(crate::state::read().registrar.roster_players.read((game_id, index)));
    }
    players.span()
}
#[starknet::component]
pub mod RegistrarState {
    use starknet::storage::{
        StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use crate::events::RowSet;
    use crate::logic::release::ReleaseState;
    use crate::logic::release::ReleaseState::InternalTrait as LifeInternal;
    use crate::presets::PresetDefinition;
    use crate::registrar::{CreateGameParams, RosterPlayer, build_game, game_overrides};

    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    pub struct Storage {
        #[flat]
        pub data: crate::state::Storage,
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
        impl Life: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of crate::registrar::IRegistrar<ComponentState<TContractState>> {
        fn register_preset(ref self: ComponentState<TContractState>, preset_id: u32, definition: PresetDefinition) {
            get_dep_component!(@self, Life).assert_authority();
            assert!(preset_id != 0, "preset id zero is reserved");
            assert!(self.data.registrar.presets.read(preset_id) == 0, "preset id already registered");
            crate::presets::validate(definition);
            crate::settlement_grid::validate_spacing(definition.settlement.spacing);
            if crate::rules::rule_enabled(definition.rules, crate::rules::SPIRES) {
                crate::spires::validate(definition.settlement.spires.expect('missing season spires'));
            } else {
                assert!(definition.settlement.spires.is_none(), "spires are disabled");
            }
            let commitment = crate::presets::commitment(definition);
            assert!(commitment != 0, "empty preset commitment");
            crate::logic::preset_record::store(commitment, definition);
            self.data.registrar.presets.write(preset_id, commitment);
            let values = array![commitment];
            self
                .emit(
                    RowSet {
                        version: 1, model: 'Preset', keys: array![preset_id.into()].span(), values: values.span(),
                    },
                );
        }
        fn preset_commitment(self: @ComponentState<TContractState>, preset_id: u32) -> felt252 {
            self.data.registrar.presets.read(preset_id)
        }
        fn next_game_id(self: @ComponentState<TContractState>) -> u32 {
            self.data.registrar.next_game.read()
        }
        fn game_id_by_name(self: @ComponentState<TContractState>, name: felt252) -> u32 {
            self.data.registrar.launch_ids.read(name)
        }
        fn blitz_roster(self: @ComponentState<TContractState>, game_id: u32) -> Span<RosterPlayer> {
            crate::logic::registrar::blitz_roster(game_id)
        }
        fn freeze_blitz_roster(
            ref self: ComponentState<TContractState>, game_id: u32, players: Span<RosterPlayer>,
        ) {
            crate::logic::release::assert_launcher();
            let game = crate::logic::game::game(game_id);
            let rules = crate::logic::game::rules(game_id);
            assert!(rules.entry_rule == crate::rules::ENTRY_ROSTER, "not a Blitz game");
            crate::registrar::validate_roster_size(players.len(), crate::logic::settlement::rules(game_id).mode);
            let count = self.data.registrar.roster_sizes.read(game_id);
            if count != 0 {
                assert!(count == players.len(), "conflicting frozen roster");
                for index in 0..count {
                    assert!(
                        self.data.registrar.roster_players.read((game_id, index)) == *players.at(index),
                        "conflicting frozen roster",
                    );
                }
                return;
            }
            assert!(!game.ready && !game.settled, "game already ready or settled");
            assert!(starknet::get_block_timestamp() < game.end_at, "game ended");
            self.register_roster(game_id, players);
            for player in players {
                crate::entity_ids::reserve_homes(game_id, (*player).account);
            }
            // Location reservations depend on the final roster size, so empty launches defer setup until freeze.
            let classes = get_dep_component!(@self, Life).classes(game_id).read();
            crate::logic::presets::initialize_gameplay(classes, game_id, rules.mode_rules);
        }
        fn create_game(ref self: ComponentState<TContractState>, params: CreateGameParams) -> u32 {
            crate::logic::release::assert_launcher();
            let classes = get_dep_component!(@self, Life).current_classes();
            let preset_commitment = self.data.registrar.presets.read(params.preset_id);
            assert!(preset_commitment != 0, "preset is not registered");
            let preset = self.data.presets.entry(preset_commitment);
            let rules = crate::registrar::LaunchRules {
                mode_rules: preset.rules.mode_rules.read(),
                day_unit_seconds: preset.rules.day_unit_seconds.read(),
                armies_tick_seconds: preset.rules.tick_config.armies_tick_in_seconds.read(),
                entry_rule: preset.rules.entry_rule.read(),
                settlement_mode: preset.settlement_mode.read(),
                spacing: preset.settlement_spacing.read(),
            };
            crate::registrar::validate_params(params, rules);
            let mut encoded = array![];
            params.serialize(ref encoded);
            let commitment = core::poseidon::poseidon_hash_span(encoded.span());
            let previous = self.data.registrar.launch_ids.read(params.name);
            if previous != 0 {
                assert!(
                    self.data.registrar.launch_commitments.read(params.name) == commitment, "conflicting game launch",
                );
                return previous;
            }
            let game_id = self.data.registrar.next_game.read();
            assert!(game_id != 0 && game_id < 0xffffffff, "game identity space exhausted");
            let release_id = self.data.current_release.read();
            self.data.game_releases.write(game_id, release_id);
            self.register_roster(game_id, params.roster);
            let game = build_game(params, rules.entry_rule);
            let overrides = game_overrides(game_id, params);
            crate::logic::game::create(game_id, game, overrides);
            crate::logic::game::emit_release(game_id, release_id, crate::logic::game::preset_commitment(game));
            for player in params.roster {
                crate::entity_ids::reserve_homes(game_id, (*player).account);
            }
            if rules.entry_rule != crate::rules::ENTRY_ROSTER || !params.roster.is_empty() {
                crate::logic::presets::initialize_gameplay(classes, game_id, rules.mode_rules);
            }
            self.data.registrar.launch_ids.write(params.name, game_id);
            self.data.registrar.launch_commitments.write(params.name, commitment);
            self.write_next_game(game_id + 1);
            game_id
        }
    }
    #[generate_trait]
    pub impl InternalImpl<
        TContractState,
        +HasComponent<TContractState>,
        impl Life: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of InternalTrait<TContractState> {
        fn register_roster(ref self: ComponentState<TContractState>, game_id: u32, players: Span<RosterPlayer>) {
            if players.is_empty() {
                return;
            }
            let mut accounts: core::dict::Felt252Dict<bool> = Default::default();
            for index in 0..players.len() {
                let player = *players.at(index);
                assert!(player.account != 0.try_into().unwrap(), "unbound roster player");
                assert!(!accounts.get(player.account.into()), "duplicate roster player");
                accounts.insert(player.account.into(), true);
                self.data.registrar.roster_players.write((game_id, index), player);
            }
            self.data.registrar.roster_sizes.write(game_id, players.len());
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
            self.data.registrar.next_game.write(next);
        }
    }
}
