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
fn initialize_gameplay(game_id: u32) {
    crate::banes::IWorldBanesDispatcherTrait::initialize_bane_calendar(
        crate::banes::IWorldBanesLibraryDispatcher {
            class_hash: crate::logic::release::class_of(game_id, crate::slots::BRIDGE),
        },
        game_id,
    );
    crate::deep::IDeepSitesDispatcherTrait::initialize_deep(
        crate::deep::IDeepSitesLibraryDispatcher {
            class_hash: crate::logic::release::class_of(game_id, crate::slots::MAP),
        },
        game_id,
    );
    crate::race::IRaceDispatcherTrait::initialize_race(
        crate::race::IRaceLibraryDispatcher {
            class_hash: crate::logic::release::class_of(game_id, crate::slots::ECONOMY),
        },
        game_id,
    );
}
#[starknet::component]
pub mod RegistrarState {
    use starknet::storage::{
        StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use crate::events::RowSet;
    use crate::logic::release::ReleaseState;
    use crate::registrar::{CreateGameParams, RosterPlayer, build_game, game_overrides};
    use super::initialize_gameplay;

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
        fn next_game_id(self: @ComponentState<TContractState>) -> u32 {
            self.data.registrar.next_game.read()
        }
        fn game_id_by_name(self: @ComponentState<TContractState>, name: felt252) -> u32 {
            self.data.registrar.launch_ids.read(name)
        }
        fn blitz_roster(self: @ComponentState<TContractState>, game_id: u32) -> Span<RosterPlayer> {
            crate::logic::registrar::blitz_roster(game_id)
        }
        fn game_seater(self: @ComponentState<TContractState>, game_id: u32) -> starknet::ContractAddress {
            self.data.registrar.seaters.read(game_id)
        }

        fn create_game(ref self: ComponentState<TContractState>, params: CreateGameParams) -> u32 {
            crate::logic::release::assert_launcher();
            let release_id = self.data.open_releases.read(params.family);
            assert!(release_id != 0, "family has no open release");
            crate::registrar::validate_params(params);
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
            self.data.game_releases.write(game_id, release_id);
            self.data.game_creation_releases.write(game_id, release_id);
            self.register_roster(game_id, params.roster);
            self.data.registrar.seaters.write(game_id, params.seater);
            let game = build_game(params);
            let overrides = game_overrides(game_id, params);
            crate::logic::game::create(game_id, game, overrides);
            crate::logic::game::emit_release(game_id, release_id);
            for player in params.roster {
                crate::entity_ids::reserve_homes(game_id, (*player).account);
            }
            initialize_gameplay(game_id);
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
