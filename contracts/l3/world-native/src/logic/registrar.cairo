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
            crate::presets::IPresetRegistrationDispatcherTrait::register_preset(
                crate::presets::IPresetRegistrationLibraryDispatcher {
                    class_hash: get_dep_component!(@self, Life).current_classes().season,
                },
                preset_id,
                definition,
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
            crate::logic::presets::initialize_gameplay(classes, game_id, rules.mode_rules);
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
            let mut wallets: core::dict::Felt252Dict<bool> = Default::default();
            for index in 0..players.len() {
                let player = *players.at(index);
                assert!(player.account != 0.try_into().unwrap(), "unbound roster player");
                assert!(!accounts.get(player.account.into()), "duplicate roster player");
                accounts.insert(player.account.into(), true);
                assert!(player.wallet != 0.try_into().unwrap(), "unbound payout wallet");
                assert!(!wallets.get(player.wallet.into()), "duplicate payout wallet");
                wallets.insert(player.wallet.into(), true);
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
