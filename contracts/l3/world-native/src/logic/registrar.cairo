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
        StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{get_caller_address, get_contract_address};
    use crate::events::RowSet;
    use crate::logic::release::ReleaseState;
    use crate::logic::release::ReleaseState::InternalTrait as LifeInternal;
    use crate::presets::PresetDefinition;
    use crate::registrar::{CreateGameParams, RosterPlayer, build_game, game_rules};

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
            crate::presets::validate(definition);
            crate::settlement_grid::validate_spacing(definition.settlement.spacing);
            if crate::rules::rule_enabled(definition.rules, crate::rules::SPIRES) {
                crate::spires::validate(definition.settlement.spires.expect('missing season spires'));
            } else {
                assert!(definition.settlement.spires.is_none(), "spires are disabled");
            }
            let commitment = crate::presets::commitment(definition);
            assert!(commitment != 0, "empty preset commitment");
            self.data.registrar.presets.write(preset_id, commitment);
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
        fn create_game(
            ref self: ComponentState<TContractState>, params: CreateGameParams, definition: PresetDefinition,
        ) -> u32 {
            get_dep_component!(@self, Life).assert_authority();
            let classes = get_dep_component!(@self, Life).current_classes();
            crate::registrar::validate_params(params, definition.rules, definition.settlement);
            let mut encoded = array![];
            params.serialize(ref encoded);
            definition.serialize(ref encoded);
            let commitment = core::poseidon::poseidon_hash_span(encoded.span());
            let previous = self.data.registrar.launch_ids.read(params.name);
            if previous != 0 {
                assert!(
                    self.data.registrar.launch_commitments.read(params.name) == commitment, "conflicting game launch",
                );
                return previous;
            }
            self.validate_preset(params.preset_id, crate::presets::commitment(definition));
            let game_id = self.data.registrar.next_game.read();
            assert!(game_id != 0 && game_id < 0xffffffff, "game identity space exhausted");
            self.data.game_releases.write(game_id, self.data.current_release.read());
            self.register_roster(game_id, params.roster);
            let game = build_game(params, get_caller_address());
            let rules = game_rules(game_id, params, definition.rules);
            crate::logic::game::create(game_id, game, rules);
            let settlement_rules = crate::settlement::SettlementRules {
                registration_start: params.registration_start,
                registration_limit: params.roster.len().try_into().unwrap(),
                mode: if definition.rules.entry_rule == crate::rules::ENTRY_ROSTER {
                    definition.settlement.mode
                } else {
                    crate::settlement::SettlementMode::Single
                },
                spacing: definition.settlement.spacing,
            };
            crate::logic::presets::initialize_game(classes, game_id, definition, settlement_rules);
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
        fn initialize(ref self: ComponentState<TContractState>) {
            assert!(self.data.registrar.next_game.read() == 0, "registrar already initialized");
            self.write_next_game(1);
        }
        fn validate_preset(self: @ComponentState<TContractState>, preset_id: u32, definition_commitment: felt252) {
            let commitment = self.data.registrar.presets.read(preset_id);
            assert!(commitment != 0, "preset is not registered");
            assert!(commitment == definition_commitment, "preset definition mismatch");
        }
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
