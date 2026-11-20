use crate::registrar::*;

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
        StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use crate::events::RowSet;
    use crate::logic::release::ReleaseState;
    use crate::registrar::{CreateGameParams, build_game, game_overrides};
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
            let game = build_game(params);
            let overrides = game_overrides(game_id, params);
            crate::logic::game::create(game_id, game, overrides);
            crate::logic::game::emit_release(game_id, release_id);
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
        fn write_next_game(ref self: ComponentState<TContractState>, next: u32) {
            self.data.registrar.next_game.write(next);
        }
    }
}
